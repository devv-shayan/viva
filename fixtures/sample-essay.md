# Sample submission — "Should Karachi Adopt Congestion Pricing?"

Student: Areeba Khan · Course: Urban Policy 201 · ~520 words
(Paragraph IDs p1–p6 are assigned at ingest by splitting on blank lines.)

---

Karachi loses an estimated hundreds of billions of rupees each year to traffic
congestion, and the city's roads cannot be widened out of the problem. This
essay argues that Karachi should adopt a congestion pricing scheme for its
central business district, charging private vehicles a fee to enter during
peak hours. Cities that have priced congestion have reduced traffic while
funding public transport, and Karachi's situation is severe enough that
inaction is now the costlier choice.

The strongest evidence comes from cities that have tried it. London introduced
its congestion charge in 2003 and saw traffic in the charging zone fall by
around 15 percent, with journey-time reliability improving in the first years
of the scheme. Stockholm's trial produced similar reductions and, notably,
public support rose after residents experienced the benefits, leading to a
permanent scheme approved by referendum. These cases show that congestion
pricing works not by punishing drivers but by making the true cost of road
space visible.

Critics argue that congestion pricing falls hardest on low-income commuters,
who may have no alternative to driving. This concern is real but overstated in
Karachi's case. The majority of peak-hour trips into the central district are
made by private cars owned by higher-income households, while most low-income
commuters already rely on buses, chingchis, and motorcycles. A pricing scheme
that exempts motorcycles and reinvests revenue into the Green Line and
People's Bus Service would leave most low-income commuters better off, not
worse.

A second objection is that enforcement in Karachi would be impossible. However,
enforcement costs will be minimal because the scheme can reuse the ANPR camera
infrastructure already being installed for the Safe City project, and because
compliance in comparable cities has been high once cameras were visible.

Revenue is the final piece of the argument. A modest fee of 200 rupees per
entry, applied to even a fraction of the vehicles entering the central
district daily, would generate billions of rupees annually. Ring-fencing this
revenue for public transport, as London does, would create a virtuous cycle:
better buses make it easier to leave the car at home, which further reduces
congestion.

Congestion pricing is not politically easy, and Karachi is not London. But the
evidence from other cities, the equity profile of Karachi's actual commuters,
and the availability of enforcement infrastructure make the case stronger here
than critics allow. The city should pilot a scheme in the central business
district within two years, with exemptions for motorcycles and emergency
vehicles, and publish the revenue accounts publicly. The alternative is to
keep paying the congestion tax we already pay — in hours, fuel, and air — and
get nothing back for it.

---

## Expected ArgumentGraph (acceptance criteria for /api/analyze)

- **Thesis** (p1): Karachi should adopt CBD congestion pricing.
- **c1** (p2): pricing reduces traffic — evidence: London ~15% reduction 2003,
  Stockholm trial + referendum. Rubric: evidence-support.
- **c2** (p3): equity concern is overstated in Karachi — evidence: claimed
  composition of peak-hour trips (NOTE: asserted, no source cited → weak-ish;
  counterargument handling). Rubric: counterarguments.
- **c3 / assumption** (p4): "enforcement costs will be minimal" via Safe City
  ANPR reuse — **kind: assumption, evidence: []** → must appear in weakSpots.
  Rubric: trade-offs.
- **c4** (p5): revenue ring-fencing creates virtuous cycle — evidence: London
  practice. Rubric: evidence-support / trade-offs.

Rubric objectives for the fixture:
r1 "Supports claims with cited evidence" · r2 "Engages counterarguments
honestly" · r3 "Reasons about policy trade-offs"
