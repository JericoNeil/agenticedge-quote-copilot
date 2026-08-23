/**
 * The seeded inbox. Five inbound messages, all fictional, all in English.
 *
 * The demo clock is fixed so that a re-take of the screen recording produces an
 * identical quote number, issue date and validity date.
 */

export const DEMO_TODAY_ISO = "2026-01-12";
export const DEMO_TODAY = new Date(2026, 0, 12, 9, 0, 0);

export interface InboundMessage {
  id: string;
  from: string;
  fromEmail: string;
  fromCompany: string;
  subject: string;
  receivedLabel: string;
  receivedIso: string;
  body: string;
}

export const INBOX: InboundMessage[] = [
  {
    id: "m1",
    from: "Helena Vos",
    fromEmail: "helena.vos@lindqvistanalytics.example",
    fromCompany: "Lindqvist Analytics",
    subject: "Request for quote: office fit out, Diagonal 477",
    receivedLabel: "Today 08:42",
    receivedIso: "2026-01-12T08:42:00",
    body: `Hi Elena,

We have signed on a 420 square metre floor at Diagonal 477 and need a full fit out priced. The space needs a strip out of the existing partitions and ceiling, then new flooring and lighting throughout.

We are planning 60 workstations with power and data to every desk, plus six glass partitioned meeting rooms. Our space planning drawings show roughly 78 linear metres of glazed partitioning. Furniture install is in scope, we are buying the furniture ourselves.

We must be trading from the new floor by the end of March. Could you send a fixed price and a programme?

Thanks,
Helena Vos
Head of Workplace, Lindqvist Analytics`,
  },
  {
    id: "m2",
    from: "Rafael Costa",
    fromEmail: "rafael.costa@brumacoffee.example",
    fromCompany: "Bruma Coffee Houses",
    subject: "Quote request: flooring and lighting refresh, three sites",
    receivedLabel: "Today 07:58",
    receivedIso: "2026-01-12T07:58:00",
    body: `Hello Elena,

We are refreshing three sites this spring and would like a price from you. Each unit is roughly 95 square metres and the scope is flooring and lighting only. Nothing structural, and we are keeping the counters and the back of house exactly as they are.

The units are in Sants, Sarria and Badalona. We would run them one at a time and close each store for a week.

Everything needs to be finished by 22 May, before the summer trading period. Could you price all three in one quote and show the rate per site?

Many thanks,
Rafael Costa
Operations Manager, Bruma Coffee Houses`,
  },
  {
    id: "m3",
    from: "Ingrid Solheim",
    fromEmail: "ingrid.solheim@havstadmarine.example",
    fromCompany: "Havstad Marine Services",
    subject: "Re: Quote NFI-2026-0142, any update?",
    receivedLabel: "Fri 16:20",
    receivedIso: "2026-01-09T16:20:00",
    body: `Hi Elena,

I am chasing quote NFI-2026-0142 for the Poblenou office. Our board meets on Thursday and I need to put a recommendation in front of them.

I should be straight with you. Another contractor has come back about eleven percent lower on what looks like the same specification. I would rather work with your team, so if there is anything you can do on the number, or anything in their price that is not really comparable, now is the moment to tell me.

Can you come back to me by Wednesday afternoon?

Best,
Ingrid Solheim
Finance Director, Havstad Marine Services`,
  },
  {
    id: "m4",
    from: "Clara Bonet",
    fromEmail: "clara.bonet@meridianlegal.example",
    fromCompany: "Meridian Legal Partners",
    subject: "Eixample: acoustic panelling to the two meeting rooms",
    receivedLabel: "Fri 11:05",
    receivedIso: "2026-01-09T11:05:00",
    body: `Hi Elena,

One more change before the ceilings close. The partners sat in the two large meeting rooms yesterday and both are far too live, you can hear everything from the corridor.

We would like acoustic panelling added to both rooms. Our consultant measured the treatable wall area at roughly 48 square metres in total, so 24 per room.

Please price this as a variation on the current project and tell me what it does to the programme. We need it agreed before the ceilings close on 6 February.

Thanks,
Clara Bonet
Operations Lead, Meridian Legal Partners`,
  },
  {
    id: "m5",
    from: "Oriol Camps",
    fromEmail: "oriol.camps@campsaymar.example",
    fromCompany: "Camps and Aymar Advocats",
    subject: "Office move",
    receivedLabel: "Thu 17:41",
    receivedIso: "2026-01-08T17:41:00",
    body: `Hi Elena,

We are moving offices soon and might need some work done, can you send me a price?

We are a team of 20 and we have outgrown the current place. Nothing is signed yet, but I want a number ready for my partner before we commit to anything. A colleague at Halden mentioned you did their office and spoke well of the finish.

Can you send something over this week?

Thanks,
Oriol Camps
Managing Partner, Camps and Aymar Advocats`,
  },
];

export const FOLDERS = [
  { id: "inbox", label: "Inbox", count: 5 },
  { id: "sent", label: "Sent", count: 12 },
  { id: "drafts", label: "Drafts", count: 2 },
  { id: "quotes", label: "Quotes", count: 6 },
];
