export type LegalPageDefault = {
  slug: string;
  locale: string;
  title: string;
  summary: string;
  body: string;
};

const INSTITUTE = 'Ranjan Educational Institute';

/**
 * Starter public notices. They describe how this product actually works.
 * Publishing a later version replaces what learners and the public site read.
 * They are not a substitute for a lawyer's review of the institute's own rules.
 */
export const LEGAL_PAGE_DEFAULTS: LegalPageDefault[] = [
  {
    slug: 'privacy',
    locale: 'en',
    title: 'Privacy Policy',
    summary: 'What we collect about learners and staff, and why.',
    body: `${INSTITUTE} ("we") runs a learner app and an admin console for courses, tests, live classes, documents, and support.

We collect information you give us: name, email, phone if you provide it, batch, and the messages you send to Support. We also store learning activity that the product needs in order to work: enrollments, lesson progress, test attempts and scores, live-class attendance, certificates, admit cards, and orders.

Staff sign-in uses an account email and a session token kept in the browser. The admin console also remembers which menu groups you left open. The learner app keeps a sign-in token on the device. We do not sell personal information and we do not run third-party advertising cookies.

Staff can see a learner's records only as far as their role allows. High-impact admin actions are written to an audit log that learners cannot open.

If you ask us to export or delete an account, we record the request and work through it. Submitting the request does not by itself finish deletion. Academic, payment, and other records we are required to keep may remain, with as little identity as the law and the contract allow.

To ask a privacy question, open Support in the app or write to the contact published by the institute. This notice takes effect on the date shown on the page. A newer published version replaces this one.`,
  },
  {
    slug: 'terms',
    locale: 'en',
    title: 'Terms of Use',
    summary: 'Rules for using the learner app and the admin console.',
    body: `These terms cover use of ${INSTITUTE}'s learner app and admin console.

You must use your own account. Do not share a password, a sign-in token, or a downloaded document with someone who is not entitled to it. We may suspend an account that is misused, including cheating on a test, copying paid lessons, or interfering with another person's account.

Course material, tests, recordings, and certificates are provided for enrolled learners. A practice score is not an official government or university result. Completing a course does not promise a job, a rank, or admission.

Orders stay pending until the institute confirms them. A payment provider may be unconfigured. In that case the console can record an order, but it does not take money from a bank by itself. Refunds follow the Refund Policy.

We may change these terms by publishing a new version. The version in force is the latest one marked published, from its effective date. If you keep using the app after that date, you are using it under the new version.

Questions about these terms go to Support.`,
  },
  {
    slug: 'refund',
    locale: 'en',
    title: 'Refund Policy',
    summary: 'How a refund request is recorded, and what approval does not do.',
    body: `You can ask ${INSTITUTE} for a refund on an order. Tell Support the order and the reason, or ask staff to record the request in the admin console.

Staff review the request and can record a decision. An approval stored in the console is the institute's decision. It does not, by itself, send money back through a bank or a payment gateway. If no payment provider is configured, no gateway refund is sent from this product. Finance completes any actual transfer outside the button you see on screen.

Access to a course should be reviewed after a refund is recorded. Recording the refund does not delete the course, the learner, or the order history.

Ask Support for the status of a specific order. This policy does not promise a fixed number of days or an automatic refund.`,
  },
  {
    slug: 'cancellation',
    locale: 'en',
    title: 'Cancellation Policy',
    summary: 'How to cancel an enrollment or close an account.',
    body: `You may ask ${INSTITUTE} to cancel an enrollment or to close a learner account. Send the request through Support and name the course or the account.

Access ends when staff revoke the enrollment or suspend the account. Until that happens, the enrollment stays active. Closing an account does not erase records we must keep, and it does not by itself return money. Money already paid follows the Refund Policy.

A live class that is cancelled is marked cancelled on the schedule. Cancelling a class does not cancel an enrollment unless staff also revoke it.

We will tell you through Support when the cancellation has been applied.`,
  },
  {
    slug: 'cookies',
    locale: 'en',
    title: 'Cookie Policy',
    summary: 'What this product stores in the browser.',
    body: `${INSTITUTE}'s admin console stores a sign-in token in the browser so staff stay signed in, and it stores menu preferences (which groups are open, and whether the sidebar is collapsed).

The learner app stores a sign-in token on the device for the same reason.

We do not use third-party advertising cookies in this product. Clearing site data or signing out removes the admin session token. You will need to sign in again after that.

If a later version of the product adds an optional analytics cookie, this page will be updated and republished before that cookie is used.`,
  },
  {
    slug: 'disclaimer',
    locale: 'en',
    title: 'Disclaimer',
    summary: 'What the learning material is, and what it is not.',
    body: `Material on ${INSTITUTE}'s app is for education and practice. It is not legal, medical, financial, tax, or government advice, and it is not an official exam result.

Lesson videos, notes, tests, ranks, and certificates are prepared for teaching. A published result is the institute's record of that sitting. It is not a claim that a public examination body has issued the same mark.

Live class links, video playback, and checkout work only when the matching provider is configured. A screen that says a provider is not configured means that part of the product cannot complete the outside service yet.

We take care to keep content accurate and may correct it. We do not promise that every page is complete or that a particular study plan will produce a particular outcome.`,
  },
  {
    slug: 'acceptable-use',
    locale: 'en',
    title: 'Acceptable Use',
    summary: 'Conduct we expect in classes, tests, and support.',
    body: `Use ${INSTITUTE}'s app for your own learning or, if you are staff, for your job.

Do not cheat on a test, share answers during a sitting, or let someone else attempt a test in your name. Do not copy paid lessons, recordings, or documents to people who are not enrolled.

In live classes and Support, do not harass, threaten, or post unlawful content. Do not try to enter another person's account, probe the service for weaknesses, or disrupt a class.

We may remove content, end a session, or suspend an account that breaks these rules. Where a record of the action is required, staff record it through the normal admin screens, which writes an audit event.`,
  },
  {
    slug: 'grievance',
    locale: 'en',
    title: 'Grievance and Contact',
    summary: 'How to raise a privacy, content, or service complaint.',
    body: `If something is wrong with your account, a class, a result, a document, or the way your information was used, contact ${INSTITUTE} through Support in the app. Give your name, the account email, and what you want changed.

We record the request, check that it is yours, and track it until staff close it with an outcome. A privacy or deletion request is not finished only because it was submitted. We will say so through Support when the work is done, including when some records must be kept.

The institute's public contact details, when configured, are the ones shown in Settings and on the public site. Until a dedicated grievance address is published there, Support is the channel that reaches staff.

This page is the contact notice for privacy and other legal questions about the learner app and the admin console.`,
  },
];
