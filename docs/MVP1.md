# MVP1 Vision

## Vision

Create the simplest way for software businesses to replace traditional pricing plans with one interactive pricing block where customers can select only the features they want and see their price change instantly.

MVP1 should prove one core idea:

> Customers do not need to choose between Basic, Pro, or Enterprise. They can build the package that fits them.

## Main Goal

Allow a product owner to create a list of features, assign pricing to those features, and embed one pricing block inside their website or application.

Customers should then be able to:

- Search available features
- Select or remove features using checkboxes
- Adjust quantities where allowed
- See the total price update instantly
- Review exactly what they are paying for
- Continue to checkout or the next step

## MVP1 User Flow

### Business Owner

The owner creates an account and creates a project.

They then add the features available in their product.

Example:

- AI Assistant
- Analytics
- Team Members
- Storage
- PDF Export
- Priority Support

For each feature, the owner can set:

- Feature name
- Short description
- Price
- Billing type
- Category
- Required or optional
- Active or inactive

The owner can then preview the pricing block and receive an embed code for their project.

### Customer

The customer opens the pricing block inside the business's website or application.

They can immediately browse or search available features.

Example:

☑ Core Platform — $10/month

☐ AI Assistant — +$8/month

☑ Analytics — +$5/month

Team Members<br>
[-] 3 [+]

The total updates automatically.

**Current Total: $24/month**

The customer always knows what they selected and what each item costs.

## One Pricing Block

MVP1 should not include traditional pricing cards such as:

Starter<br>
Professional<br>
Business<br>
Enterprise

There should be only one pricing experience.

The pricing block should contain:

- Search
- Categories
- Feature list
- Checkboxes
- Quantity controls
- Individual prices
- Live total
- Pricing summary
- Continue button

## Pricing Types for MVP1

Keep the first version simple.

Support:

**Fixed recurring price**

Example:

Analytics — $10/month

**One-time price**

Example:

Setup — $25 once

**Quantity pricing**

Example:

Team Member — $3 per member/month

That is enough to demonstrate the concept.

Advanced usage pricing can come later.

## Required Features

Owners should be able to mark certain features as required.

For example:

☑ Core Platform — $10/month<br>
Required

The customer sees it but cannot remove it.

This allows businesses to maintain a minimum price while still allowing customization.

## Same Pricing for Multiple Features

Owners should also be able to assign the same price to several features.

For example:

Any Premium Tool — $5/month each

- AI Writer
- Image Generator
- PDF Tools
- Translation
- Analytics

The customer can select whichever tools they need.

## Categories

Owners can organize features into groups.

Example:

- AI
- Collaboration
- Storage
- Marketing
- Integrations
- Support

The customer can filter by category instead of scrolling through a long list.

## Search

Search should be a major part of MVP1.

If a product has 50 features, the customer should be able to type:

“analytics”

and immediately see matching features.

This keeps the pricing block usable even as the number of features increases.

## Real-Time Pricing Engine

Every selection should immediately update the total.

For example:

Base Platform: $10

Analytics: +$5

AI Assistant: +$8

3 Team Members: +$9

Total:

**$32/month**

There should be no page refresh.

## Pricing Summary

Before continuing, the customer should see exactly what they selected.

Example:

### Your Package

Core Platform — $10

Analytics — $5

AI Assistant — $8

3 Team Members — $9

**Total: $32/month**

This summary can later be passed to the business's checkout system.

## AI in MVP1

AI should be useful but very lightweight in the first version.

Include one button:

**Suggest Features**

The business owner can optionally provide descriptions explaining who each feature is useful for.

When the customer requests help, AI uses those configured features to recommend a small selection.

Example:

“You selected Team Management and Client Projects. You may also find Analytics useful for tracking project performance.”

AI should never automatically add a paid feature.

The customer must approve every selection.

## Owner Dashboard

MVP1 dashboard should contain:

### Projects

Create and manage projects.

### Features

Create, edit, delete, activate, and deactivate features.

### Categories

Organize features.

### Pricing

Set prices and billing rules.

### Pricing Block

Preview the customer experience.

### Integration

Get the embed code.

### Basic Analytics

Show simple information such as:

- Number of pricing sessions
- Most selected features
- Most removed features
- Average package value

Advanced analytics can come later.

## Integration

The first integration should be extremely simple.

For example:

```html
<script src="pricing.js"></script>

<smart-pricing project="project_123"></smart-pricing>
```

The developer should not need to build the pricing UI themselves.

The platform handles it.

## What MVP1 Should NOT Include

Do not build these yet:

- Automatic project scanning
- Advanced AI pricing recommendations
- Usage tracking
- Behavior-based upselling
- Automatic upsells
- Complex usage billing
- Multiple payment providers
- Enterprise contracts
- Dynamic regional pricing
- Machine-learning pricing optimization
- Advanced experimentation
- Large analytics dashboards

Those belong in future versions.

## Success Criteria

MVP1 succeeds if a developer can:

1. Create a project.
2. Add their product features.
3. Give those features prices.
4. Embed one pricing block.
5. Allow customers to customize their package.
6. Calculate the correct price instantly.
7. Capture the customer's final configuration.

If that experience feels easier than creating traditional pricing plans, the core concept has been proven.

## MVP1 Positioning

**Old way**

Choose a predefined plan.

Basic — $10<br>
Pro — $30<br>
Business — $60

**Our way**

Build your own plan.

Choose what you need.<br>
Leave out what you don't.<br>
Your price updates instantly.

## Core MVP1 Message

> One pricing block. Every customer gets their own package.

## Long-Term Foundation

MVP1 should be built so future versions can later add:

- Project scanning
- AI monetization maps
- Pricing recommendations
- Usage tracking
- Feature entitlements
- Smart upsells
- Customer behavior analysis
- Dynamic pricing
- Billing integrations

MVP1 does not need to solve all of those problems.

It only needs to establish the foundation on which they can be built.
