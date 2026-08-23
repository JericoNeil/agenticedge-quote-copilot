# Recording script

## The easy way: let it play itself

Open this and do nothing:

```
https://jericoneil.github.io/agenticedge-quote-copilot/?demo=1
```

The page runs the whole sequence on its own, with no cursor and no clicking: the reply is drafted in the measured style, the quote is built and costed, and then the vague enquiry is opened and refused. A thin progress line across the top of the window shows how far through it is, and it turns green and reads `demo complete` at the end, so a recording has a clean start and finish. It takes about fifteen seconds.

Two things matter for a clean capture:

1. **Keep the window focused while it plays.** Chrome slows down timers in background tabs, which stretches the sequence out. Click into the window, then start recording.
2. **Load the page once before the take.** The first load fetches fonts and the script; a reload after that starts instantly.

To record it on a Mac, press Shift, Command and 5, choose `Record Selected Portion`, drag around the browser window, press Record, then reload the demo URL. Stop when the line turns green. QuickTime saves it as a .mov you can drop straight into Keynote or PowerPoint.

If you would rather present it live than play a video, just open the demo URL in front of the board. It is the real prototype, so it holds up if anyone asks you to run it again.

## Driving it by hand

Everything below is the same sequence, done manually, in case you want to pause on a particular screen or answer a question mid-demo.


Live prototype: https://jericoneil.github.io/agenticedge-quote-copilot/

Before recording, open the settings drawer and press `Reset demo`, then close it. The engine mode must read `LOCAL`. Record at 1440 by 900 or wider so the mail shell and the copilot pane are both fully visible.

## 15 second take

The point of this take is that a costed quote appears without anybody typing a number.

```
0s   Load the page. The inbox, the open message from Helena Vos and the docked
     Agentic Edge Copilot pane are all visible at once.

2s   Point at the highlighted phrases in the message body. Those are the fields
     the extractor pulled out: 420 square metres, 60 workstations, 78 linear
     metres, end of March.

4s   Click "Draft reply".
     Stages step through: Reading message, Extracting requirements, Matching
     sender style profile, Composing draft, Scoring style match.

7s   The draft appears. It opens "Hi Helena", closes "Best regards, Elena Ruiz"
     and carries every extracted quantity. Both come from the style profile
     measured above it, not from a template.

9s   Click "Build quote".

11s  The quotation renders. Scroll to the totals so the full build up is on
     screen: subtotal 96,210.00, project management, contingency, volume
     discount, IVA, total payable 127,403.59.

15s  End on the total.
```

## 30 second take

Adds the two things a board is most likely to ask about: where the style came from, and what happens when the system does not know enough.

```
0s   Load the page.

3s   Point at the style profile. Say the numbers out loud: mean sentence 13.4
     words, greeting "Hi {first}" 67 percent, sign-off "Best regards" 75
     percent, recurring phrases "happy to" and "let me know". All measured from
     the twelve messages in the Sent folder, not configured by hand.

7s   Click "Draft reply". The draft lands in that measured voice.

11s  Click "Build quote". The quotation renders.

15s  Point at any line item. Each one quotes the exact phrase in the email it
     was derived from, so every euro traces back to something the client wrote.

18s  Click the quantity field on "Design and space planning" and change 420 to
     700. The subtotal, the fees, the discount band, the IVA and the total all
     recompute, and the volume discount moves from 4 percent to 7 percent.

23s  Click the last message in the inbox, "Office move" from Oriol Camps.

26s  The copilot flips to "Unqualified enquiry", 17 percent confidence, and
     shows "Handed to a person" with the questions it wants asked. It refuses
     to price.

30s  End on the refusal card.
```

## Line worth saying over the recording

Every figure in that quote is computed in TypeScript. Even with the live Claude toggle switched on, the model writes the prose and the arithmetic stays in code, because a language model should never be the thing that decides a price.

## Notes for re-takes

- `Reset demo` in the settings drawer returns everything to first load.
- The draft composer samples from the learned greeting and sign-off distributions, so the exact opening line can vary between runs. The quantities, the totals and the confidence scores are deterministic and will be identical every time.
- The `Send` control is disabled by design. Do not try to click it during a take.
