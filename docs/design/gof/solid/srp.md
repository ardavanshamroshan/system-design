# Single Responsibility Principle

> Software Design · SOLID · hands-on Laravel + FastAPI

**Related:** [Catalog](/design/gof/) · [Design Patterns overview](/design/design-patterns) · [Principles](/design/principles)

## Intent

A module should have **one reason to change** — one stakeholder, one axis of volatility.
In Laravel that often means splitting HTTP validation, domain rules, persistence, and notifications.
In FastAPI the same split shows up as thin routers, Pydantic schemas, services, and repositories.

## The smell (problem)

`OrderService` grows every sprint: pricing tweaks from finance, email copy from marketing, tax rules from compliance.
One merge conflict file; one flaky test suite; every bug fix risks breaking an unrelated feature.

## Solution

Keep **coordination** in a use-case class (`PlaceOrder`, `place_order`) and push each volatile concern behind
a narrow collaborator. The use case should read like a recipe, not a kitchen sink.

## Structure

```
Client ──► PlaceOrder (use case)
              ├── PriceCalculator
              ├── OrderRepository
              └── OrderNotifier
```

## Examples

Switch **Laravel** / **FastAPI** in each tab group. Same idea, two stacks.

### Before (smell)

::: code-group

```php [Laravel]
// app/Services/OrderService.php — three reasons to change in one class
final class OrderService
{
    public function place(array $payload): Order
    {
        $total = 0;
        foreach ($payload['items'] as $item) {
            // finance changes tax logic here every quarter
            $total += $item['price'] * $item['qty'];
        }
        $order = Order::create(['total' => $total, 'email' => $payload['email']]);

        // marketing rewrites this template monthly
        Mail::to($payload['email'])->send(new OrderPlaced($order));

        return $order;
    }
}
```

```python [FastAPI]
# app/routers/orders.py — router owns business + persistence + email
@router.post("/orders")
def create_order(body: OrderCreate, db: Session = Depends(get_db)):
    total = sum(i.price * i.qty for i in body.items)
    order = Order(email=body.email, total=total)
    db.add(order)
    db.commit()
    send_smtp(body.email, f"Order {order.id} placed")  # hard to mock
    return order
```

:::

### After (pattern)

::: code-group

```php [Laravel]
// app/Domain/Orders/PlaceOrder.php — orchestrates; does not calculate or send mail itself
final class PlaceOrder
{
    public function __construct(
        private PriceCalculator $prices,
        private OrderRepository $orders,
        private OrderNotifier $notifier,
    ) {}

    public function handle(Cart $cart): Order
    {
        $order = $this->orders->save(
            Order::fromCart($cart, $this->prices->total($cart))
        );
        $this->notifier->placed($order);

        return $order;
    }
}

// app/Providers/AppServiceProvider.php
$this->app->bind(OrderRepository::class, EloquentOrderRepository::class);
$this->app->bind(OrderNotifier::class, MailOrderNotifier::class);
```

```python [FastAPI]
# app/services/place_order.py
class PlaceOrder:
    def __init__(
        self,
        prices: PriceCalculator,
        repo: OrderRepository,
        notifier: OrderNotifier,
    ):
        self._prices = prices
        self._repo = repo
        self._notifier = notifier

    def handle(self, cart: Cart) -> Order:
        order = self._repo.save(Order.from_cart(cart, self._prices.total(cart)))
        self._notifier.placed(order)
        return order

def get_place_order(
    prices: PriceCalculator = Depends(get_price_calculator),
    repo: OrderRepository = Depends(get_order_repository),
    notifier: OrderNotifier = Depends(get_order_notifier),
) -> PlaceOrder:
    return PlaceOrder(prices, repo, notifier)
```

:::

### How to call it

::: code-group

```php [Laravel]
// routes/api.php
Route::post('/orders', function (StoreOrderRequest $request, PlaceOrder $action) {
    return response()->json($action->handle($request->toCart()), 201);
});

// app/Http/Requests/StoreOrderRequest.php — validation stays at HTTP edge
final class StoreOrderRequest extends FormRequest
{
    public function rules(): array
    {
        return ['email' => ['required', 'email'], 'items' => ['required', 'array']];
    }

    public function toCart(): Cart
    {
        return Cart::fromValidated($this->validated());
    }
}
```

```python [FastAPI]
router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=OrderOut)
def create_order(
    body: OrderCreate,
    action: PlaceOrder = Depends(get_place_order),
) -> OrderOut:
    return OrderOut.model_validate(action.handle(body.to_cart()))

# tests/test_place_order.py
def test_place_order_uses_fake_notifier(client):
    app.dependency_overrides[get_order_notifier] = lambda: RecordingNotifier()
    response = client.post("/orders", json={...})
    assert response.status_code == 201
```

:::

Container resolves `PlaceOrder` with concrete repositories bound in `AppServiceProvider`.
Feature-test with `Mail::fake()` and an in-memory `OrderRepository` fake to prove each collaborator is optional in isolation.

### Sample response

::: code-group

```json [Laravel]
HTTP/1.1 201 Created
{
  "id": 1042,
  "total": 318000,
  "status": "pending"
}
```

```json [FastAPI]
{
  "id": 1042,
  "total": 318000,
  "status": "pending"
}
```

:::

Mail and pricing classes can be unit-tested without hitting HTTP or the database.

## When to use

- A class or module comment says "and also handles …"
- Different teams own different parts of the same file
- You cannot unit-test one concern without booting the framework
- Stand-ups keep tying unrelated bugs to the same service class
- You want queue workers and HTTP controllers to share orchestration without copy-paste

::: tip
SRP is about **stakeholders**, not counting methods. If only one team owns the file and change rate is low, resist splitting.
:::

## When not to use

- Splitting would create one-line classes that only wrap a single line (over-fragmentation)
- The code is a one-off script or migration

## Pitfalls <Badge type="danger" text="Must-know" />

Confusing SRP with "one method per class." Responsibility is about **change drivers**, not line count.
Splitting too early produces a maze of DTOs with no business win.

## Takeaway

Name the stakeholder. If marketing and finance both edit this file, it violates SRP — no matter how pretty the pattern names are.

