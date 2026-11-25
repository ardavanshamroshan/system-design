# ACID & Transactions

> Database · Lessons + Q&A · Question bank part 2 · 18 questions · [All questions](/interview/)

<QaControls />

## Lessons {#lessons}

### The four letters and the mechanism behind each

- **Atomicity (all or nothing):** If something fails midway, no trace remains. In Postgres the row versions created by an aborted transaction are marked "invisible" and VACUUM collects them; InnoDB rolls back using the undo log.
- **Consistency:** The database moves from one valid state to another valid state. The database's tools are constraints (PK, FK, UNIQUE, CHECK, NOT NULL), but the correctness of business rules is the application's responsibility.
- **Isolation:** Concurrent transactions have no unwanted effect on each other. Implemented with locks (2PL) or snapshots (MVCC). Because full isolation is expensive, it comes in levels.
- **Durability:** After the commit response, data is not lost in a crash. Mechanism: WAL and fsync at commit time. Surviving a disk failure requires replication and backups.

By contrast, the BASE model (Basically Available, Soft state, Eventual consistency) prefers availability over immediate consistency. ACID only has meaning inside a single database; across several services you have to work with Saga, Outbox and idempotency.

| Anomaly | Read Committed | Repeatable Read in Postgres | Serializable |
| --- | --- | --- | --- |
| Dirty read | No | No | No |
| Non-repeatable read | Yes | No | No |
| Phantom read | Yes | No | No |
| Lost update | Yes | Aborted with an error | No |
| Write skew | Yes | Yes | No |

### Isolation levels in practice: PostgreSQL versus MySQL <Badge type="danger" text="Must-know" />

The level names are the same in the SQL standard but their behaviour differs in every database. Two things you must know by heart: the Postgres default is Read Committed and the InnoDB default is Repeatable Read; and "Repeatable Read" is not the same thing in the two.

| Level | PostgreSQL | MySQL InnoDB |
| --- | --- | --- |
| Read Uncommitted | Same as Read Committed; dirty reads do not exist | Real dirty reads |
| Read Committed | **Default.** Every statement takes a fresh snapshot | Every statement takes a fresh snapshot; gap locks are mostly out of the picture |
| Repeatable Read | Snapshot isolation; writing to a row that changed after the snapshot is aborted with `40001` | **Default.** Snapshot for plain reads; next-key locks for locking reads and writes; no serialization error |
| Serializable | SSI: optimistic, blocks nobody, `40001` on conflict | 2PL: every plain `SELECT` effectively becomes `FOR SHARE`; more waiting and more deadlocks |

The anomaly matrix when you put the two databases side by side:

| Anomaly | Read Committed (both) | Repeatable Read in Postgres | Repeatable Read in InnoDB | Serializable (both) |
| --- | --- | --- | --- | --- |
| Dirty read | No | No | No | No |
| Non-repeatable read | Yes | No | No | No |
| Phantom read | Yes | No | Not in plain reads; possible with locking reads or the transaction's own writes | No |
| Lost update | Yes | Aborted with `40001` | Yes (silently) | No |
| Write skew | Yes | Yes | Yes | No |

The practical consequence: code that appears to work in InnoDB with "read, compute in the application, write" changes behaviour when migrated to Postgres (or the other way round). Do not lean on the isolation level; wherever correctness matters be explicit: an atomic update, `FOR UPDATE`, a version column or a database constraint.

### MVCC and snapshot intuition <Badge type="danger" text="Must-know" />

Under MVCC a write does not change the row in place; it creates a new version. In Postgres every version carries two tags: `xmin` (the transaction that created it) and `xmax` (the transaction that deleted or replaced it). A snapshot means "the list of transactions that had committed at the moment the picture was taken"; any version whose creator is not in that list is not visible. Like taking a photo of a whiteboard: everyone else keeps writing but you read from your own photo. The result: readers do not block writers and writers do not block readers.

The only difference between Read Committed and Repeatable Read in Postgres is when the picture is taken:

```text
time  ──────────────────────────────────────────────────────────▶
T1 (RC)   BEGIN   SELECT (snapshot #1)        SELECT (snapshot #2)  COMMIT
T1 (RR)   BEGIN   SELECT (snapshot #1)        SELECT (snapshot #1)  COMMIT
T2                          UPDATE + COMMIT
                                              RC: sees T2's change
                                              RR: still sees the old row
```

The cost of this model: old versions have to stay for as long as some old snapshot needs them. This is why a transaction left open for hours blocks VACUUM and tables bloat (question 2.9). In InnoDB the old versions live in the undo log and a long transaction grows the history list.

### WAL, fsync and group commit <Badge type="warning" text="Important" />

The write-ahead rule: before a change to a page reaches the data file, the record of that change must be in the WAL on disk. At commit only that transaction's WAL is fsynced (a sequential, cheap write); the data pages are written later by the checkpoint and the background writer (random, expensive writes). After a crash, the database replays the WAL from the last checkpoint.

```text
COMMIT ─▶ WAL record in memory ─▶ fsync WAL ─▶ "OK" to client
                                      │
            later: checkpoint writes dirty data pages, old WAL is recycled
```

The bottleneck of commit is that fsync; on an ordinary SSD each fsync takes from a few tens of microseconds to a few milliseconds. Group commit writes several concurrent transactions with one fsync; this is why write throughput rises with concurrency, yet 10,000 single-row transactions one after another are far slower than one transaction with 10,000 rows. `synchronous_commit = off` responds before the fsync: in a crash the last few transactions (at most about three times `wal_writer_delay`) are lost but the database is not corrupted, and it can be set for just one transaction with `SET LOCAL`.

### Transaction boundaries in application code <Badge type="danger" text="Must-know" />

Most transactional bugs do not come from SQL; they come from the transaction boundary being in the wrong place in the code. Three rules: open and close the transaction in the use-case layer (not inside the repository), run every query on the same connection, and keep all external I/O out of it.

In Go a transaction means one specific connection from the pool; any query executed with `db` (not `tx`) runs on a different connection and outside the transaction:

```go
func Transfer(ctx context.Context, db *sql.DB, from, to, amount int64) error {
    tx, err := db.BeginTx(ctx, nil) // default isolation: READ COMMITTED on Postgres
    if err != nil {
        return err
    }
    defer tx.Rollback() // no-op after a successful Commit

    res, err := tx.ExecContext(ctx,
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1`, amount, from)
    if err != nil {
        return err
    }
    if n, _ := res.RowsAffected(); n == 0 {
        return ErrInsufficientFunds
    }
    if _, err = tx.ExecContext(ctx,
        `UPDATE accounts SET balance = balance + $1 WHERE id = $2`, amount, to); err != nil {
        return err
    }
    return tx.Commit()
}
```

In Laravel the closure defines the boundary: an exception means rollback and a normal return means commit. Work that must happen "only if it committed" is registered with `afterCommit`:

```php
DB::transaction(function () use ($order) {
    $order->update(['status' => 'paid']);
    $order->items()->update(['locked' => true]);

    // runs only if the outermost transaction commits
    DB::afterCommit(fn () => SendReceipt::dispatch($order->id));
}, 3); // up to 3 attempts on deadlock
```

### Distributed transactions: just a pointer <Badge type="info" text="Good to know" />

All of the guarantees above hold inside one database. As soon as an operation involves two databases, or a database and a message broker, there is no longer "one commit". There are two ways out: 2PC/XA (atomic but blocking; question 2.16) or giving up atomicity and reaching eventual consistency with <span class="vip-locked" title="VIP members only">Saga <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> and <span class="vip-locked" title="VIP members only">Outbox <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>. In a service-oriented architecture the second is chosen almost always: the event is written to an outbox table in the same local transaction and published later.

### Quick summary

| Topic | What you should remember |
| --- | --- |
| Defaults | Postgres: Read Committed · InnoDB: Repeatable Read |
| Read Committed | A snapshot per statement; two consecutive `SELECT`s may see two worlds |
| Repeatable Read in Postgres | One snapshot for the whole transaction; write conflict → `40001` and retry |
| Serializable in Postgres | SSI; always with a retry loop |
| MVCC | Readers and writers do not block each other; the price is dead versions and VACUUM |
| Durability | fsync of the WAL at commit; group commit spreads the cost |
| Transaction boundary | Short, on one connection, no HTTP and no email; side effects after commit |
| Lost update and write skew | Do not lean on the isolation level; atomic update, lock or constraint |
| Across services | Outbox, Saga and idempotent consumers; not 2PC |

## Questions & answers {#qa}

### 2.1 — What is ACID? <Badge type="danger" text="Must-know" /> {#q-2-1}

::: details Answer {open}
**Answer:** Atomicity (all or nothing), Consistency (constraints hold before and after), Isolation (concurrent transactions behave as if they ran one after another) and Durability (it is permanent after commit).

**Real-world example:** A money transfer; debiting A and crediting B in one transaction. **Use case:** Every financial, inventory and booking operation.

<strong class="qa-trap">Interview trap:</strong> The letter C is mostly the application's responsibility, and Isolation in practice comes in levels; the default of most databases is not Serializable.
:::

### 2.2 — How is Atomicity implemented? <Badge type="warning" text="Important" /> {#q-2-2}

::: details Answer {open}
**Answer:** With a log. In the undo model (InnoDB) the previous value is kept and restored on rollback. In Postgres a new row version is written and the transaction's status (commit or abort) decides whether it is visible; so rollback is nearly free.

**Real-world example:** An error in the middle of inserting 1000 rows; none of them are visible. **Use case:** A savepoint for a partial rollback inside one transaction.

<strong class="qa-trap">Interview trap:</strong> Atomicity is about "abortability", not concurrency; that is the subject of Isolation.
:::

### 2.3 — What exactly does Durability guarantee? <Badge type="warning" text="Important" /> {#q-2-3}

::: details Answer {open}
**Answer:** The commit record is fsynced to disk before the response goes to the client. Group commit writes several transactions with one fsync. In Postgres the `synchronous_commit` parameter sets the level: `off` (fast; risk of losing the last few transactions), `on` and `remote_apply` (waits until it is applied on the standby).

**Real-world example:** A low-value event log with `off`; payments with a synchronous standby. **Use case:** Deciding your RPO.

<strong class="qa-trap">Interview trap:</strong> A disk that lies about fsync, or `fsync=off`, means a risk of corruption, not just lost data.
:::

### 2.4 — How does Consistency in ACID differ from Consistency in CAP? <Badge type="warning" text="Important" /> {#q-2-4}

::: details Answer {open}
**Answer:** In ACID it means the data's constraints and invariants keep holding. In CAP it means all nodes see one identical, fresh value (linearizability).

**Real-world example:** The constraint "balance must not go negative" is the first kind; "the replica still shows the old value" is the second kind.
:::

### 2.5 — Isolation levels and read phenomena? <Badge type="danger" text="Must-know" /> {#q-2-5}

::: details Answer {open}
**Answer:** A dirty read is reading uncommitted data; a non-repeatable read is two different values for one row; a phantom is new rows appearing when a range query is repeated. Read Committed prevents the first, Repeatable Read prevents the second, and Serializable prevents all of them.

**Postgres note:** The Read Uncommitted level is effectively Read Committed; its Repeatable Read is snapshot isolation; Serializable is implemented with SSI and the `40001` error must be retried.

**Use case:** Read Committed for most OLTP; Serializable or explicit locks for inventory and bookings.
:::

### 2.6 — What is a lost update and how do you prevent it? <Badge type="danger" text="Must-know" /> {#q-2-6}

::: details Answer {open}
**Answer:** Two transactions read a value, both write based on the old value and one of the changes is lost. Four ways:

1. Atomic update: `UPDATE t SET n = n - 1 WHERE id = ?`
2. Pessimistic lock: `SELECT ... FOR UPDATE`
3. Optimistic lock: a `version` column in the WHERE condition
4. Repeatable Read or Serializable level together with retry

**Real-world example:** Two admins correct a product's stock at the same time.
:::

### 2.7 — What is write skew and why is snapshot isolation not enough? <Badge type="warning" text="Important" /> {#q-2-7}

::: details Answer {open}
**Answer:** Two transactions read shared data, each changes a different row and together they break a rule. Because the rows differ, no write conflict is seen.

**Real-world example:** Two on-call doctors check at the same time that "someone else is on" and both go off. **Use case:** The fix: Serializable, or a lock on the shared row (`FOR UPDATE`), or a constraint in the database (an exclusion constraint for range bookings).
:::

### 2.8 — Savepoints and nested transactions? <Badge type="warning" text="Important" /> {#q-2-8}

::: details Answer {open}
**Answer:** Relational databases do not have true nested transactions; a savepoint is a point you can roll back to without rolling back further.

**Real-world example:** Nested `DB::transaction()` in Laravel is implemented with savepoints. **Use case:** Continuing a batch when one item fails.

<strong class="qa-trap">Interview trap:</strong> In Postgres, after an error the whole transaction becomes "aborted" unless you used a savepoint.
:::

### 2.9 — Why is a long transaction dangerous? <Badge type="danger" text="Must-know" /> {#q-2-9}

::: details Answer {open}
**Answer:** It holds locks, blocks VACUUM, creates lag and occupies a pool connection.

**Real-world example:** An HTTP call to the payment gateway inside a transaction. **Use case:** Do external work before or after the transaction and coordinate with an Outbox.
:::

### 2.10 — How do you write a transaction with retry? <Badge type="warning" text="Important" /> {#q-2-10}

::: details Answer {open}
**Answer:** Serialization (`40001`) and deadlock (`40P01`) errors are transient and the whole transaction must be run again from the start; so the body must have no external side effects.

```go
func withTx(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) error {
    for attempt := 0; attempt < 3; attempt++ {
        tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
        if err != nil {
            return err
        }
        if err = fn(tx); err == nil {
            err = tx.Commit()
        } else {
            _ = tx.Rollback()
        }
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && (pgErr.Code == "40001" || pgErr.Code == "40P01") {
            continue // serialization failure or deadlock: safe to retry
        }
        return err
    }
    return errors.New("transaction retries exhausted")
}
```

**Use case:** In Laravel the second argument of `DB::transaction($fn, 3)` does the same for deadlocks.
:::

### 2.11 — ACID or BASE? Transactions across several services? <Badge type="warning" text="Important" /> {#q-2-11}

::: details Answer {open}
**Answer:** ACID inside one service; between services, eventual consistency with Saga, Outbox and idempotent consumers. 2PC is possible but blocking and fragile.

**Real-world example:** Order and payment in two separate services.
:::

### 2.12 — How exactly do Read Committed and Repeatable Read differ in behaviour in Postgres? <Badge type="danger" text="Must-know" /> {#q-2-12}

::: details Answer {open}
**Answer:** Two differences. First, the timing of the snapshot: in Read Committed every statement takes a fresh snapshot, in Repeatable Read the whole transaction works with the snapshot of its first statement (not the moment of `BEGIN`). Second, the behaviour when writing to a row that another transaction changed concurrently: in Read Committed the statement waits, and after the other side commits it re-evaluates the `WHERE` condition against the new version and carries on; in Repeatable Read it is aborted with error `40001` (`could not serialize access due to concurrent update`) and you have to retry the whole transaction.

```sql
-- session A                                   -- session B
BEGIN; -- READ COMMITTED
SELECT count(*) FROM orders WHERE user_id = 7; -- 3
                                               -- INSERT INTO orders (user_id) VALUES (7); COMMIT;
SELECT count(*) FROM orders WHERE user_id = 7; -- 4 under READ COMMITTED, 3 under REPEATABLE READ
COMMIT;
```

**Real-world example:** A report that reads the total and the details with several separate queries may, in Read Committed, produce a total that does not match the details; with Repeatable Read they all read from one snapshot. **Use case:** Read Committed for day-to-day OLTP work; Repeatable Read for multi-query reports, exports and anywhere "one fixed picture" is needed.

<strong class="qa-trap">Interview trap:</strong> The re-evaluation in Read Committed only makes `UPDATE ... WHERE balance >= 100` safe; the "`SELECT`, decide in the application, `UPDATE`" pattern still has lost updates because the decision was made on stale data.
:::

### 2.13 — What is autocommit and what traps does it have in Go and PHP? <Badge type="danger" text="Must-know" /> {#q-2-13}

::: details Answer {open}
**Answer:** Without an explicit `BEGIN`, every statement is its own independent transaction and is committed immediately. So two consecutive statements are not atomic: if the process dies between them, the first one stays and the second never ran. The common trap in Go is running a query inside a transaction with `db` instead of `tx`; that query runs on another connection from the pool and outside the transaction.

```go
tx, _ := db.BeginTx(ctx, nil)
defer tx.Rollback()

tx.ExecContext(ctx, `UPDATE orders SET status = 'paid' WHERE id = $1`, id)
db.ExecContext(ctx, `INSERT INTO ledger (order_id) VALUES ($1)`, id) // BUG: db, not tx
```

That line has three problems: it is not undone by the rollback, it does not see the uncommitted change made by `tx`, and if `MaxOpenConns` is small it waits for a connection that the transactions themselves are holding and the whole pool locks up.

**Real-world example:** A repository that took a `*sql.DB` in its constructor and has no idea it was called inside a transaction. The fix: methods accept the interface shared by `*sql.DB` and `*sql.Tx` (`ExecContext`, `QueryContext`, `QueryRowContext`), or the transaction is carried in the `context`. In Laravel every query inside the closure runs on one connection, but a model with a different `$connection` stays outside the transaction. **Use case:** For a single statement autocommit is the best choice; an explicit transaction costs extra round trips.

<strong class="qa-trap">Interview trap:</strong> In MySQL, DDL statements (`ALTER TABLE`, `CREATE INDEX`) silently commit the open transaction; in Postgres most DDL is transactional and gets rolled back. The opposite is a trap too: a driver that turns autocommit off, plus a forgotten commit, leaves the connection sitting in the `idle in transaction` state.
:::

### 2.14 — Why should you not send an email, a queue job or an event inside a transaction? <Badge type="danger" text="Must-know" /> {#q-2-14}

::: details Answer {open}
**Answer:** An external side effect is not undone by a rollback and its ordering relative to the commit is not guaranteed. Two common failures: (1) the job goes onto the queue before the commit, a worker picks it up immediately and does not find the row (`ModelNotFoundException`) or sees old data; (2) the email or event is sent but the transaction is rolled back afterwards and the customer has received a receipt for an order that does not exist.

```php
DB::transaction(function () use ($user) {
    $user->save();

    // BUG: SendWelcomeEmail::dispatch($user); -- a worker may pick it up before COMMIT
    SendWelcomeEmail::dispatch($user)->afterCommit(); // pushed to the queue only after COMMIT
});
```

**Real-world example:** This bug only shows up under load: in development the worker is slower than the commit and everything works. **Use case:** In Laravel, the `after_commit` option in the queue connection config, the `afterCommit()` method on a job and the `ShouldDispatchAfterCommit` interface for events. In Go, run the side effect after `Commit()` has returned successfully.

<strong class="qa-trap">Interview trap:</strong> "After commit" is not a guarantee either: if the process dies between the commit and the dispatch, the message is never sent. When losing the message is unacceptable, write the message to an outbox table in the same transaction and publish it separately (<span class="vip-locked" title="VIP members only">Outbox <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>).
:::

### 2.15 — What do you do if the connection drops right at `COMMIT`? How do you build a safe retry? <Badge type="warning" text="Important" /> {#q-2-15}

::: details Answer {open}
**Answer:** The outcome is unknown: the commit may have happened and only the response failed to arrive. Errors `40001` and `40P01` mean "it definitely did not happen" and a blind retry is safe; a network error or timeout during commit is not like that, and a blind retry means debiting the account twice. The solution is for the transaction itself to be idempotent: a unique key per request, with a UNIQUE constraint, recorded in the same transaction.

```sql
BEGIN;
INSERT INTO processed_requests (idempotency_key) VALUES ('7f3c-order-991')
ON CONFLICT (idempotency_key) DO NOTHING;
-- 0 rows inserted => this request already committed earlier: ROLLBACK and return the stored result
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

**Real-world example:** A mobile client presses the pay button again after a timeout; the `Idempotency-Key` header identifies the same request. A database failover in the middle of a commit creates the same situation. **Use case:** Every non-repeatable operation: payment, stock deduction, issuing an invoice.

<strong class="qa-trap">Interview trap:</strong> The key has to be recorded in the same transaction as the main work. If the key is recorded in Redis or in a separate transaction, there is again a window where one has happened and the other has not.
:::

### 2.16 — How do 2PC and XA work and why are they rarely used? <Badge type="info" text="Good to know" /> {#q-2-16}

::: details Answer {open}
**Answer:** In phase one (prepare) the coordinator asks every participant to take the transaction to the brink of commit and promise that it can commit; in phase two, if everyone promised it issues the commit, otherwise a rollback. XA is the standard interface for this protocol. In Postgres it is implemented with `PREPARE TRANSACTION` and is off by default (`max_prepared_transactions = 0`).

```sql
-- on each participant
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
PREPARE TRANSACTION 'transfer-991'; -- phase 1: survives restart, keeps its locks

-- coordinator, after every participant prepared successfully
COMMIT PREPARED 'transfer-991';     -- phase 2 (or ROLLBACK PREPARED 'transfer-991')

-- find orphans left by a dead coordinator
SELECT gid, prepared FROM pg_prepared_xacts;
```

**Real-world example:** If the coordinator dies after prepare, the participants stay "in-doubt": they hold their locks, block VACUUM and have no right to decide on their own. **Use case:** Inside distributed databases and sharding tools that have a resilient coordinator; or between two databases controlled by one team. Between microservices, Saga and Outbox.

<strong class="qa-trap">Interview trap:</strong> 2PC gives atomicity, not isolation: between the first participant's commit and the second's, a reader sees a half-done state. Unavailability multiplies as well: when any participant is down, the whole operation stops.
:::

### 2.17 — What is a deferred constraint and where is it needed? <Badge type="info" text="Good to know" /> {#q-2-17}

::: details Answer {open}
**Answer:** By default constraints are checked immediately after every statement (and an ordinary UNIQUE in Postgres even row by row). A constraint declared `DEFERRABLE` can be postponed until commit; that is, a temporarily invalid state is allowed in the middle of the transaction, provided it is valid at the end. Only UNIQUE, PRIMARY KEY, FOREIGN KEY and EXCLUDE have this capability; `NOT NULL` and `CHECK` are always immediate.

```sql
ALTER TABLE slides
    ADD CONSTRAINT slides_deck_pos_uniq UNIQUE (deck_id, position)
    DEFERRABLE INITIALLY IMMEDIATE;

BEGIN;
SET CONSTRAINTS slides_deck_pos_uniq DEFERRED;
UPDATE slides SET position = 2 WHERE id = 10; -- temporary duplicate is allowed
UPDATE slides SET position = 1 WHERE id = 11;
COMMIT; -- checked here
```

**Real-world example:** Swapping the order of two items with a uniqueness constraint on `position`; inserting two rows that point at each other with FOREIGN KEYs (a circular dependency). **Use case:** Bulk loading data with tables in an arbitrary order.

<strong class="qa-trap">Interview trap:</strong> The error moves to the moment of `COMMIT`; code that only checks statement errors and ignores the commit error misses it. A deferrable UNIQUE constraint also cannot be used in `ON CONFLICT`, and InnoDB has no deferred constraints at all.
:::

### 2.18 — What is a read-only transaction good for? How do you run a long report safely? <Badge type="info" text="Good to know" /> {#q-2-18}

::: details Answer {open}
**Answer:** A transaction is meaningful for reads too: several `SELECT`s in one Repeatable Read transaction all read from one snapshot and their numbers agree with each other. `READ ONLY` prevents accidental writes and documents the intent. `pg_dump` takes a consistent backup in exactly this way.

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT count(*) FROM orders WHERE created_at >= '2026-01-01';
SELECT sum(total) FROM orders WHERE created_at >= '2026-01-01'; -- same snapshot as the count
COMMIT;
```

In Go the same thing is built with `sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true}`.

**Real-world example:** A nightly export that reads several tables and has to be "a picture of one instant". **Use case:** Run the heavy report on a replica so the primary stays free. At the Serializable level, the `READ ONLY DEFERRABLE` mode waits for a safe snapshot and then runs with no SSI overhead and no risk of `40001`.

<strong class="qa-trap">Interview trap:</strong> Read-only does not mean free. An old snapshot on the primary prevents dead versions from being cleaned up (bloat). On a replica, a long query conflicts with WAL replay and is cancelled with `canceling statement due to conflict with recovery`; you have to choose between `max_standby_streaming_delay` (more lag) and `hot_standby_feedback` (bloat on the primary).
:::

## Related {#related}

- <span class="vip-locked" title="VIP members only">Optimistic vs Pessimistic Locking <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Locks & Concurrency <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
- <span class="vip-locked" title="VIP members only">Saga Pattern <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span>
