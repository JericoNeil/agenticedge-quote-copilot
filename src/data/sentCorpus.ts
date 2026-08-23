/**
 * Twelve past sent messages written by Elena Ruiz, Commercial Director at
 * Nordic Fit Interiors, S.L. This is the corpus the style profiler reads.
 * Every company, person and project here is fictional.
 */

export interface SentEmail {
  id: string;
  to: string;
  company: string;
  subject: string;
  date: string;
  body: string;
}

export const AUTHOR_FIRST_NAME = "Elena";
export const AUTHOR_FULL_NAME = "Elena Ruiz";
export const AUTHOR_TITLE = "Commercial Director";
export const AUTHOR_COMPANY = "Nordic Fit Interiors, S.L.";
export const AUTHOR_EMAIL = "elena.ruiz@nordicfitinteriors.es";

export const SENT_CORPUS: SentEmail[] = [
  {
    id: "s1",
    to: "Marc Delcroix",
    company: "Vantage Retail Group",
    subject: "Re: Pricing for the Gracia unit",
    date: "2025-11-04",
    body: `Hi Marc,

Thanks for the call this morning. I have put the revised numbers together and the fixed price now sits at 61,400 euros before IVA. The saving comes from reusing the existing ceiling grid, which we confirmed on site last week.

I am happy to walk you through the build up line by line if that helps your board.

Let me know if you want the survey booked for Thursday and I will hold the slot.

Best regards,
Elena`,
  },
  {
    id: "s2",
    to: "Sofia Marchetti",
    company: "Halden Publishing",
    subject: "Site survey, Tuesday 11 November",
    date: "2025-11-06",
    body: `Hi Sofia,

Our surveyor can be with you at nine on Tuesday and will need about two hours. He will measure the floor plate, check the riser positions and photograph the existing services.

We don't need the space to be empty, although clear access to the perimeter would help a great deal.

I am more than happy to join for the first half hour if you would like to talk through the layout options in person.

Best regards,
Elena`,
  },
  {
    id: "s3",
    to: "Ivan Petrov",
    company: "Petrov Mechanical",
    subject: "Programme update, Sant Marti fit out",
    date: "2025-11-12",
    body: `Hello Ivan,

The partitions are going up on the eighteenth, so your first fix can start on the twentieth rather than the twenty fifth. That gives us four extra days before the ceiling closes.

I have attached the updated programme. Please confirm your team can cover the new dates.

If anything on that sequence doesn't work for you, let me know today and we will replan around it.

Many thanks,
Elena`,
  },
  {
    id: "s4",
    to: "Clara Bonet",
    company: "Meridian Legal Partners",
    subject: "Variation 03 approved",
    date: "2025-11-18",
    body: `Hi Clara,

Variation 03 is approved on our side. The additional glazing to the two meeting rooms adds 8,120 euros before IVA and eleven days to the programme.

I have issued the revised completion date as 19 December. That still leaves a clear week before your move in.

Let me know if you would like the drawings reissued with the change marked up. I am happy to send those over today.

Best regards,
Elena`,
  },
  {
    id: "s5",
    to: "Tomas Ling",
    company: "Aurora Labs Iberia",
    subject: "Handover pack and snagging",
    date: "2025-11-21",
    body: `Hi Tomas,

We finished the snagging list this afternoon. There are nine items left and all of them are minor, mostly paint touch ups and one door closer.

Our team will clear them on Monday morning before your staff arrive.

The handover pack with warranties, test certificates and the operations manual is ready. I am happy to bring a printed copy when I come over.

Let me know if you need anything else before Monday.

Best regards,
Elena`,
  },
  {
    id: "s6",
    to: "Nuria Vidal",
    company: "Casavella Group",
    subject: "Payment terms on the framework",
    date: "2025-11-25",
    body: `Dear Nuria,

Thank you for sending the draft framework agreement. We're comfortable with the scope and the service levels as written.

The one point we would like to revisit is payment. Our standard terms are thirty days net from invoice date, and the draft currently states sixty.

We would be glad to hold the rates for the full twelve months in exchange for the shorter term. I am happy to discuss this on a call whenever suits you.

Kind regards,
Elena`,
  },
  {
    id: "s7",
    to: "Peter Hollands",
    company: "Brightwave Studios",
    subject: "Quote NFI-2025-0392 attached",
    date: "2025-11-27",
    body: `Hi Peter,

The quote is attached. It covers design, strip out, partitions, flooring, lighting and the power and data to all forty desks.

The total is 148,960 euros before IVA. That includes a four percent volume discount because the area is over three hundred square metres.

The price holds for thirty days. Let me know if you want us to price the furniture package separately, I am more than happy to put that together.

Best regards,
Elena`,
  },
  {
    id: "s8",
    to: "Marta Serrano",
    company: "Nordic Fit Interiors",
    subject: "Resourcing for January",
    date: "2025-12-02",
    body: `Hi Marta,

January is tighter than I expected. We have two fit outs starting in the same week and only one project manager free.

Could you check whether Dani can move his start date forward by ten days? If he can't, we will need to bring in a contract PM for six weeks.

I am happy to make the call to the agency today if you think that is the safer option. Let me know what you decide.

Best regards,
Elena`,
  },
  {
    id: "s9",
    to: "Dieter Krause",
    company: "Kestrel Foods Iberia",
    subject: "Delay on the ceiling deliveries",
    date: "2025-12-05",
    body: `Hello Dieter,

I want to flag a delay before it becomes a surprise. Our ceiling supplier has pushed delivery from the ninth to the sixteenth.

We are resequencing so the flooring and the electrical second fix move up, which absorbs most of the impact. The completion date doesn't change.

I am sorry for the noise on this. Let me know if you would like a short call to go through the revised programme.

Best regards,
Elena`,
  },
  {
    id: "s10",
    to: "Alba Ferrer",
    company: "Solace Wellness Studios",
    subject: "Re: New studio in Poblenou",
    date: "2025-12-09",
    body: `Good morning Alba,

Thank you for getting in touch about the new studio.

Before I can price this properly I need the floor area in square metres, the completion date you are working towards and whether the mechanical services are staying as they are.

Once I have those three things I can turn a fixed price around in two working days. I am more than happy to visit the unit first if that's easier.

Best regards,
Elena`,
  },
  {
    id: "s11",
    to: "Jonas Berg",
    company: "Northline Logistics",
    subject: "Thursday walkthrough confirmed",
    date: "2025-12-11",
    body: `Hi Jonas,

Thursday at ten works for us. I will bring Dani, who runs the site team, and our lighting designer.

We should be done in an hour. If you can have the landlord's fit out guide to hand, that will save us a follow up.

Let me know if the time slips at your end. I am happy to move to the afternoon.

All the best,
Elena`,
  },
  {
    id: "s12",
    to: "Rosa Delgado",
    company: "Verity Insurance Iberia",
    subject: "Final account, Eixample office",
    date: "2025-12-16",
    body: `Hi Rosa,

The final account is agreed at 213,480 euros before IVA, which is 1.4 percent under the contract sum.

The saving is mostly on the furniture install, where you supplied four fewer workstations than we allowed for.

I've asked accounts to raise the final invoice on thirty day terms. Let me know if you need the cost report broken down by trade, I am happy to send that across.

Best regards,
Elena`,
  },
];
