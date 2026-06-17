# Sub-processors

**Last updated: June 20, 2026**

Agent Atlas uses a small set of trusted third parties ("sub-processors") to help
us run Atlas for Real Estate (the "Service"). A sub-processor is a company that may
process customer data on our behalf so we can provide the Service. We require each
sub-processor to protect data under obligations substantially similar to those in
our [Data Processing Addendum](https://agent-atlas.co/legal/dpa), and we remain
responsible for their performance.

This page is the canonical, current list of our sub-processors. It is referenced by
our [Privacy Policy](https://agent-atlas.co/legal/privacy) and
[Data Processing Addendum](https://agent-atlas.co/legal/dpa).

## Current sub-processors

| Sub-processor | What it does for us | Data it may process | Location |
|---|---|---|---|
| Anthropic (Claude) | AI inference and processing that powers the agents | Prompts, task context, connected-account data needed for a task, and AI transcripts | United States |
| Stripe | Subscription and payment processing | Payment card and billing information | United States |
| Supabase | Database and authentication | Account information, stored customer data and AI outputs | United States |
| Google Cloud (KMS) | Encryption key management — encrypts and decrypts stored connected-account credentials | Encryption keys protecting connected-account OAuth tokens (the tokens are stored encrypted at rest) | United States |
| Render | Application and background-worker hosting (runs the agents) | Account data, Customer Data, and AI content processed in transit and in compute while a task runs | United States |
| Netlify | Marketing website hosting | Data transmitted while using the public website | United States |
| Langfuse | Observability and tracing of AI activity | Prompts, outputs, and usage metadata | United States |
| Sentry | Error and performance tracking | Log and error data, which can include limited usage and technical context | United States |

We do not use customer connected-account data, including Google user data, to
train, develop, or improve generalized AI or machine learning models. Anthropic
processes data only to perform the task you requested and does not use data
submitted through its API to train its models, as described in Anthropic's
commercial terms.

## How we handle changes

Before a new sub-processor begins processing customer data, we will update this
page and provide notice as described in our Data Processing Addendum. Customers can
object to a new sub-processor on reasonable data protection grounds as set out in
Section 7 of the [Data Processing Addendum](https://agent-atlas.co/legal/dpa).

## Get notified of changes

To be notified when this list changes, email atlas@agent-atlas.co with the subject
"Subscribe: sub-processor updates" and we will add you to the notification list.

## Questions

Questions about our sub-processors can be sent to atlas@agent-atlas.co.
