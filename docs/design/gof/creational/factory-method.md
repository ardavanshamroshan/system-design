# Factory Method

> Software Design · GoF Creational · hands-on Laravel + FastAPI

**Related:** [Catalog](/design/gof/) · [Design Patterns overview](/design/design-patterns) · [Principles](/design/principles)

## Intent

Define an interface for creating a product, but let **subclasses** (or container bindings)
decide which concrete product to instantiate. Callers depend on `InvoiceFactory`, not `new PdfInvoice`.

In reviews, ask: **what changes often** in Factory Method? That answer should map to the new type or boundary you extract.

## The smell (problem)

`InvoiceController` switches on `format` query param with three `new …Invoice` branches.
Adding PEPPOL XML means editing the controller and every test that hits the route.

::: warning
Interview signal: if you cannot explain *who suffers* when this code changes (Factory Method), the abstraction is premature.
:::

## Solution

Abstract creator exposes `issue()`; concrete factories override `create()` to pick Pdf vs Xml.
HTTP layer receives `InvoiceFactory` from the container keyed by tenant config.

### Reading the code

Trace the request from the HTTP entrypoint to the abstraction you introduced. If you can still find
a `match` on `type` or `gateway` inside the use case, the pattern is not finished yet.

### Naming review

Prefer domain names (`PaymentGateway`, `ShippingCalculator`) over pattern names (`PaymentFactoryFactory`).
In interviews, describe **Factory Method** using your domain sentence, then mention the pattern vocabulary.

### Regression safety

Keep one characterization test per binding: given a cart/order fixture, assert the observable response
(factory-method) stays stable when you add a second implementation behind the same port.

::: tip
Domain: **tax invoices**. Keep framework wiring at the edges; keep the pattern visible in plain PHP/Python classes.
:::

## Structure

```
Client ──► InvoiceFactory::issue()
              ├── PdfInvoiceFactory::create()
              └── XmlInvoiceFactory::create()
```

## Examples

Switch **Laravel** / **FastAPI** in each tab group. Same idea, two stacks.

### Before (smell)

::: code-group

```php [Laravel]
// app/Http/Controllers/InvoiceController.php
final class InvoiceController
{
    public function store(InvoiceRequest $request): JsonResponse
    {
        $data = $request->validated();

        // smell: controller chooses concrete product
        $invoice = match ($data['format']) {
            'pdf' => new PdfInvoice($data),
            'xml' => new XmlInvoice($data),
            default => throw new ValidationException('unknown format'),
        };

        return response()->json(['payload' => $invoice->render()]);
    }
}
```

```python [FastAPI]
@router.post("/invoices")
def issue_invoice(body: InvoiceCreate) -> dict[str, str]:
    if body.format == "pdf":
        invoice = PdfInvoice(body)
    elif body.format == "xml":
        invoice = XmlInvoice(body)
    else:
        raise HTTPException(400, "unknown format")
    return {"payload": invoice.render()}
```

:::

### After (pattern)

::: code-group

```php [Laravel]
// app/Contracts/Billing/Invoice.php
interface Invoice
{
    public function render(): string;
}

// app/Billing/InvoiceFactory.php — creator
abstract class InvoiceFactory
{
    // Factory Method — subclasses supply product
    abstract protected function create(array $data): Invoice;

    final public function issue(array $data): string
    {
        return $this->create($data)->render();
    }
}

final class PdfInvoiceFactory extends InvoiceFactory
{
    protected function create(array $data): Invoice
    {
        return new PdfInvoice($data);
    }
}

final class XmlInvoiceFactory extends InvoiceFactory
{
    protected function create(array $data): Invoice
    {
        return new PeppolXmlInvoice($data);
    }
}
```

```python [FastAPI]
class Invoice(Protocol):
    def render(self) -> str: ...


class InvoiceFactory(Protocol):
    def issue(self, data: InvoiceCreate) -> str: ...


class PdfInvoiceFactory:
    def issue(self, data: InvoiceCreate) -> str:
        return PdfInvoice(data).render()


class XmlInvoiceFactory:
    def issue(self, data: InvoiceCreate) -> str:
        return PeppolXmlInvoice(data).render()


def get_invoice_factory(settings: Settings = Depends(get_settings)) -> InvoiceFactory:
    if settings.invoice_format == "xml":
        return XmlInvoiceFactory()
    return PdfInvoiceFactory()
```

:::

::: code-group

```php [Laravel]
// tests/Feature/FactoryMethodTest.php — swap the port this lesson introduced
public function test_factory_method_boundary_is_swappable(): void
{
    // Bind a fake of the SAME contract the production route resolves
    // (e.g. BillingPort, ShippingQuoteStrategy, InvoiceFactory — not a random gateway).
    $this->app->instance(/* Port::class */, /* new FakePort() */);
    $this->postJson(/* endpoint from How to call it */)->assertOk();
}
```

```python [FastAPI]
# tests/test_factory_method.py
def test_factory_method_dependency_override(client):
    # Override the Depends() factory that matches THIS lesson's port
    # (get_billing_port / get_quote_strategy / get_invoice_factory — not a random gateway).
    app.dependency_overrides[/* get_port */] = lambda: FakePort()
    assert client.post(/* endpoint from How to call it */).status_code == 200
```

:::

### How to call it

::: code-group

```php [Laravel]
// AppServiceProvider.php — tenant picks factory without controller edits
$this->app->bind(InvoiceFactory::class, function () {
    return match (tenant()->invoiceFormat()) {
        'xml' => new XmlInvoiceFactory(),
        default => new PdfInvoiceFactory(),
    };
});

Route::post('/invoices', function (InvoiceRequest $request, InvoiceFactory $factory) {
    return response()->json([
        'format' => tenant()->invoiceFormat(),
        'payload' => $factory->issue($request->validated()),
    ], 201);
});
```

```python [FastAPI]
@router.post("/invoices", status_code=status.HTTP_201_CREATED)
def issue_invoice(
    body: InvoiceCreate,
    factory: InvoiceFactory = Depends(get_invoice_factory),
) -> InvoiceOut:
    return InvoiceOut(format=body.format, payload=factory.issue(body))
```

:::

**Laravel review notes (Factory Method)**

- Route or job should depend on an interface, not a concrete SDK client.
- Put wiring in `AppServiceProvider` (composition root); keep domain classes framework-agnostic.
- Prefer feature tests that hit HTTP and assert JSON shape from [Sample response](#sample-response--output).

**FastAPI review notes (Factory Method)**

- Keep routers thin; inject services via `Depends()` factories declared in one module.
- Use `dependency_overrides` in tests to swap fakes without patching imports.
- Return explicit status codes (`201` creates, `409` conflicts) matching the pattern semantics.

### Sample response

::: code-group

```json [Laravel]
HTTP/1.1 201 Created
{
  "format": "pdf",
  "payload": "%PDF-1.4 ..."
}
```

```json [FastAPI]
{
  "format": "pdf",
  "payload": "%PDF-1.4 ..."
}
```

:::

::: code-group

```text [Laravel]
php artisan test --filter=CheckoutTest
PASS  Tests\Feature\CheckoutTest
✓ gateway can be swapped via container binding
```

```text [FastAPI]
pytest tests/api/test_checkout.py -q
.                                                                    [100%]
```

:::

### Laravel wiring checklist

- Prefer **contracts** in `app/Contracts` and bind implementations in `AppServiceProvider`
- Keep HTTP thin: **FormRequest** for input, action/service for orchestration
- Use **Feature tests** against fakes of the port you introduced (cache, gateway, repository)

### FastAPI wiring checklist

- Expose dependencies via **`Depends()`** factories; avoid constructing clients in routers
- Use **Pydantic** models at the edge; keep domain types framework-agnostic
- Swap implementations in tests with **`app.dependency_overrides`**

## When to use

- Product type varies by config/tenant but creation steps stay the same
- You want tests to substitute `FakeInvoiceFactory` without touching HTTP

- Team debates mention "Factory Method" or duplicate branching across modules
- You are adding a second creational variant within two sprints
- On-call pain tied to one god-method that mixes policy with infrastructure

## When not to use

- Simple value objects with one implementation (`new DTO` is clearer)
- Abstract Factory fits better when you create **families** of products together

- The team is mid-incident and needs a two-line hotfix (extract pattern after stabilize)
- You cannot write a failing test that proves the new boundary helps
- Framework code already matches the intent (e.g. Laravel Pipeline for Factory Method)

## Pitfalls <Badge type="danger" text="Must-know" />

- Static `InvoiceFactory::make()` with switch inside is Abstract Factory smell, not Factory Method
- Hiding `new` in a “God factory” with 40 methods — split creators per product line

::: warning
Copy-pasting this lesson without adapting names creates “pattern theater” — structure without a volatility axis.
:::

Over-mocking in tests can hide contract drift. Fakes should obey the same method semantics production uses.

## Takeaway

Factory Method keeps **which class** out of callers; the creator owns the `new`.

Map each new class to a recurring change request, not to a pattern checklist item.

