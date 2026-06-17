# Privacy Policy

**Effective date: June 20, 2026**

This Privacy Policy explains how Agent Atlas ("Agent Atlas," "we," "us," or "our")
collects, uses, shares, and protects information in connection with Atlas for Real
Estate, our cloud software service at agent-atlas.co (the "Service"). Agent Atlas
is operated from Richmond, Virginia, USA.

By using the Service, you agree to this Privacy Policy. If you do not agree, please
do not use the Service.

## 1. A quick summary

- We collect account information, payment information (handled by Stripe), data
  from the third-party accounts you connect, usage data, and the AI transcripts
  and outputs created when you use the Service.
- We use this information to provide and improve the Service, to bill you, to
  support you, and to keep the Service secure.
- To provide AI features, we send relevant data to Anthropic (Claude) to process
  on your behalf. We do not use your connected-account data to train AI models.
- We use a small set of other sub-processors to run the Service.
- You can disconnect connected accounts, request access to or deletion of your
  data, and contact us with privacy questions at atlas@agent-atlas.co.

## 2. Information we collect

### 2.1 Account information
When you sign up, we collect information such as your name, email address, business
or brokerage name, and the details needed to set up and secure your account.
Authentication is handled through our provider, Supabase.

### 2.2 Payment information
Subscription and hour-block payments are processed by Stripe. Stripe collects and
stores your payment card and billing details. We do not store full card numbers on
our systems. We receive limited information from Stripe such as the status of a
payment, the last four digits of a card, and billing metadata needed for
accounting and support.

### 2.3 Connected-account data
When you connect a third-party account through OAuth (for example Google
Workspace, Gmail, Calendar, and Drive, or a CRM such as Follow Up Boss or Lofty),
the Service accesses data in that account so the AI agents can do the work you
request. Depending on what you connect and enable, this can include the emails we
send for you, calendar events, the documents Atlas creates or that you select in
Drive, and CRM records such as leads, clients, conversation history, and
transaction details. Atlas draws the context it needs about your leads and
conversations primarily from the CRM you connect (for example Follow Up Boss or
Lofty). We access this data to perform the tasks you direct, and we can read from
and write to those accounts as needed (for example drafting and, where you enable
it, sending emails on your behalf). See Section 5 for the specific permissions we
request.

### 2.4 Usage data
We collect information about how you use the Service, such as the actions you take,
the agent tasks you run, your usage against your plan allowance, log data, device
and browser information, and timestamps. Our error tracking and observability
providers (Sentry and Langfuse) help us capture this for reliability and
debugging.

### 2.5 AI transcripts and outputs
When you use the AI agents, we process the inputs to the agents, the prompts and
context assembled to do the work, and the outputs the agents produce (such as
drafted emails, listing copy, CMAs, briefings, and calculations). These
transcripts and outputs are stored so you can review and reuse them.

### 2.6 Communications with us
If you contact us for support, we keep a record of that communication so we can
help you and improve the Service.

## 3. How we use information

We use the information described above to:

- Provide, operate, and maintain the Service, including running the AI agents and
  performing the tasks you request.
- Connect to and act within your connected accounts as you direct.
- Process payments, manage subscriptions and trials, meter usage, and handle hour
  blocks.
- Provide customer support and respond to your requests.
- Monitor, secure, debug, and improve the Service, including diagnosing errors and
  measuring reliability and performance.
- Communicate with you about your account, billing, security, and changes to the
  Service.
- Comply with legal obligations and enforce our Terms of Service.

We do not sell your personal information. We use anonymized and aggregated data
that does not identify you or any individual to understand usage and improve the
Service. We do not use your connected-account data, including Google user data, to
train, develop, or improve generalized AI or machine learning models. See
Sections 4 and 5.

## 4. Sub-processors and sharing

We share data with a limited set of service providers ("sub-processors") who help
us run the Service. They are authorized to use the data only to provide services
to us. Our current sub-processors include:

| Sub-processor | Purpose | Data involved |
|---|---|---|
| Anthropic (Claude) | AI inference and processing | Prompts, context, connected-account data needed for a task, and AI transcripts |
| Stripe | Payment processing | Payment card and billing information |
| Supabase | Database and authentication | Account information, stored Customer Data and Outputs |
| Google Cloud (KMS) | Encryption key management for stored credentials | Connected-account OAuth tokens, encrypted at rest using KMS-managed keys |
| Render | Application and background-worker hosting | Account data and Customer Data processed while running the Service |
| Netlify | Marketing website hosting | Data transmitted while using the public website |
| Langfuse | Observability and tracing of AI activity | Prompts, outputs, and usage metadata |
| Sentry | Error tracking | Log and error data, which can include limited usage and technical context |

A current list of sub-processors is also maintained in our Data Processing
Addendum (see Section 13).

### 4.1 Data sent to Anthropic for AI processing
To provide AI features, we send the inputs, prompts, and relevant context for each
task to Anthropic (Claude). This can include content drawn from your connected
accounts where that content is needed to perform the specific task you requested.
Anthropic processes this data only to generate the AI outputs for that task.
Anthropic does not use data submitted through its API to train its models, as
described in Anthropic's commercial terms. We do not use your connected-account
data to train, develop, or improve any generalized AI or machine learning model.
Any model use is limited to providing the user-facing features you request.

### 4.2 Other sharing
We may also share information:

- To comply with law, legal process, or a lawful government request.
- To protect the rights, property, or safety of Agent Atlas, our customers, or
  others, and to enforce our Terms.
- In connection with a merger, acquisition, financing, or sale of assets, in which
  case we will require the recipient to honor this Privacy Policy or provide notice
  of any change.

## 5. Google user data, OAuth scopes, and connected accounts

When you connect an account, you are shown the permissions (scopes) the Service is
requesting, and you authorize that access through the provider's own OAuth flow. We
request only the scopes needed to perform the tasks the Service offers. For Google
accounts, this currently means sending email on your behalf, managing your
calendar, and creating and editing the documents Atlas produces in Drive (limited
to files Atlas creates or that you explicitly select). Atlas does not read your
full Gmail mailbox and does not access files in your Drive that it did not create
or that you did not select. The lead and conversation context Atlas needs is drawn
from the CRM you connect (such as Follow Up Boss or Lofty), where the Service reads
and writes records to do the work you direct.

If we later offer features that require broader access, such as reading your full
email mailbox, we will request those additional scopes separately, show you what
they cover, and complete any verification Google requires (including the Cloud
Application Security Assessment) before those features are enabled for your
account.

The Service uses this access to act on your behalf and under your direction. You
can review and revoke access at any time, either from your account settings in the
Service or from the third-party provider's security settings. Revoking access stops
the Service from accessing that account going forward.

### 5.1 Limited Use of Google user data
Atlas for Real Estate's use and transfer of information received from Google APIs
to any other app will adhere to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements. In line with that policy:

- We use Google user data only to provide and improve the user-facing features you
  request within the Service.
- We do not use Google user data for advertising of any kind, and we do not sell
  it.
- We do not transfer Google user data to others except as needed to provide and
  improve the features you use, for security purposes, to comply with law, or as
  part of a merger or acquisition with appropriate notice.
- We do not use Google user data to train, develop, or improve generalized AI or
  machine learning models. Where Google user data is processed by an AI provider
  (Anthropic), it is used only to perform the specific task you requested and is
  not used for model training.
- We do not allow humans to read your Google user data unless: you give specific
  consent (for example to let us troubleshoot an issue you report); it is necessary
  for security purposes such as investigating abuse; it is required to comply with
  applicable law; or the data has been aggregated and anonymized for internal
  operations. We log and limit any such access.

### 5.2 Security assessment
The Service is designed to operate with non-restricted Google scopes. If and when
the Service uses restricted Google scopes (such as broad Gmail or Drive scopes), we
will complete and maintain compliance with Google's verification requirements,
including the Cloud Application Security Assessment (CASA) and periodic
reverification by a Google-approved assessor, before those scopes are enabled.

### 5.3 Other connected accounts
For CRM and other non-Google accounts you connect (such as Follow Up Boss or
Lofty), we apply the same principles: we access only what is needed to perform the
tasks you direct, we act on your behalf and under your direction, and your use of
those accounts remains subject to each provider's own terms and privacy policy.

## 6. Data retention and deletion

We keep your information for as long as your account is active and as long as
needed to provide the Service. After that, we retain information only as needed for
legitimate business purposes, such as accounting, resolving disputes, security, and
complying with legal obligations.

- **Customer Data and Outputs** are retained while your account is active. When you
  delete specific items in the Service, we remove them from active systems within a
  reasonable period.
- **AI transcripts and outputs** are retained so you can review and reuse them,
  until you delete them or close your account.
- **Connected-account data** is accessed as needed to perform tasks. We retain only
  what is needed to provide the Service and the records of work done.
- **Payment records** are retained as needed for accounting and legal requirements,
  and the underlying payment details are held by Stripe.

When you close your account, we delete or de-identify your Customer Data, Outputs,
and AI transcripts within a reasonable period after closure, except for information
we are required or permitted to keep by law. Backups are purged on a rolling basis.
You can request deletion at any time as described in Section 8.

## 7. Security

We take reasonable technical and organizational measures to protect your
information. Customer business data and AI outputs are stored on a per-tenant basis
so that one customer's data is isolated from another's. We use access controls,
encryption in transit, and provider security features to help protect data. No
method of transmission or storage is completely secure, so we cannot guarantee
absolute security. Please help protect your account by keeping your credentials
confidential and by managing who in your organization has access.

If we become aware of a data breach that affects your personal information, we will
notify you and any regulators as required by applicable law.

## 8. Your rights and choices

Depending on where you live, you may have rights regarding your personal
information, which can include the right to:

- Access the personal information we hold about you.
- Correct inaccurate information.
- Delete your personal information.
- Receive a copy of certain information in a portable format.
- Object to or restrict certain processing.

You can exercise many of these rights directly in the Service (for example by
editing your account, disconnecting accounts, or deleting items), or by contacting
us at atlas@agent-atlas.co. We will respond as required by applicable law. We will not
discriminate against you for exercising your rights. We may need to verify your
identity before acting on a request.

If you are an end client of a real estate professional who uses the Service, and
your information was provided to us by that professional, that professional is
responsible for how they use the Service, and you should direct your requests to
them. We act as that professional's processor and will assist them in responding
where appropriate. See our Data Processing Addendum in Section 13.

## 9. Cookies and analytics

The Service uses cookies and similar technologies to keep you signed in, remember
your preferences, secure the Service, and understand how the Service is used. We and
our providers may use log data and analytics to measure performance and
reliability. You can control cookies through your browser settings, though some
features may not work properly if you disable them.

## 10. Children's privacy

The Service is intended for licensed real estate professionals and is not directed
to children under 18. We do not knowingly collect personal information from
children. If you believe a child has provided us information, contact us at
atlas@agent-atlas.co and we will delete it.

## 11. International users

We operate from the United States, and we store and process information in the
United States and in the locations used by our sub-processors. If you access the
Service from outside the United States, you understand that your information will be
transferred to and processed in the United States, where data protection laws may
differ from those in your location.

## 12. Changes to this Privacy Policy

We may update this Privacy Policy from time to time. If we make material changes, we
will provide notice, for example by email or through the Service. Changes take
effect on the date stated in the updated policy. Your continued use of the Service
after changes take effect means you accept the updated policy. If we plan to access
or use a type of user data that was not disclosed when you authorized access, we
will update this policy and prompt you to consent before accessing that data.

## 13. Data Processing Addendum

When the Service processes personal information about your clients and contacts on
your behalf, you act as the controller (or business) and we act as your processor
(or service provider). Our [Data Processing Addendum](https://agent-atlas.co/legal/dpa)
("DPA"), also available on request to atlas@agent-atlas.co, describes how we process
that personal information, the sub-processors we use, the security measures we
apply, and how we handle data subject requests and breach notification. The DPA is
incorporated into our Terms of Service.

## 14. Contact us

If you have questions or requests about this Privacy Policy or your information,
contact us at atlas@agent-atlas.co.
