# GoF & SOLID — hands-on catalog

> Software Design · Gang of Four patterns + SOLID · every lesson has **Laravel** and **FastAPI** samples in tabs

This hub is the deep-dive companion to [Design Patterns overview](/design/design-patterns) and [Design Principles](/design/principles). Each page uses a concrete domain (orders, payments, notifications, documents) so you can copy structure into production code without cargo-culting inheritance.

::: tip
Read the **smell** first, then the pattern. Use the **Laravel / FastAPI** tabs on each sample — same step, two stacks.
:::

## SOLID

| Lesson | One-liner | Stack |
| --- | --- | --- |
| [Single Responsibility (SRP)](/design/gof/solid/srp) | One reason to change per class | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Open/Closed (OCP) <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Extend via new types, not edits | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Liskov Substitution (LSP) <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Subtypes must honor contracts | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Interface Segregation (ISP) <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Small interfaces per consumer | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Dependency Inversion (DIP) <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Depend on abstractions | Laravel · FastAPI |

## Creational

| Lesson | One-liner | Stack |
| --- | --- | --- |
| [Factory Method](/design/gof/creational/factory-method) | Subclass chooses concrete product | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Abstract Factory <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Families of related products | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Builder <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Step-by-step complex construction | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Prototype <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Clone instead of reconstruct | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Singleton <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | One shared instance (use sparingly) | Laravel · FastAPI |

## Structural

| Lesson | One-liner | Stack |
| --- | --- | --- |
| <span class="vip-locked" title="VIP members only">Adapter <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Make foreign API fit your port | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Bridge <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Split abstraction from implementation | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Composite <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Tree part-whole hierarchy | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Decorator <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Stack behavior on same interface | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Facade <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | One door on a messy subsystem | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Flyweight <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Share intrinsic state | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Proxy <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Surrogate with access control | Laravel · FastAPI |

## Behavioral

| Lesson | One-liner | Stack |
| --- | --- | --- |
| <span class="vip-locked" title="VIP members only">Chain of Responsibility <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Linked handlers | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Command <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Request as object | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Iterator <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Traverse without exposing structure | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Mediator <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Central coordinator | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Memento <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Snapshot and restore | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Observer <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Publish/subscribe in-process | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">State <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Behavior follows state object | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Strategy <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Pluggable algorithm | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Template Method <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | Fixed skeleton, variant steps | Laravel · FastAPI |
| <span class="vip-locked" title="VIP members only">Visitor <span class="vip-badge" title="VIP members only" aria-label="VIP"><span class="vip-star" aria-hidden="true">★</span></span></span> | External operations on a structure | Laravel · FastAPI |

::: warning
Patterns are vocabulary, not trophies. Prefer framework primitives (Pipeline, Events, `Depends`, container bindings) when they already express the same structure.
:::
