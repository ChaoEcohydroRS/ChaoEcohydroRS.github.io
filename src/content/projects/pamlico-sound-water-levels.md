---
order: 2
title: When does a shoreline gauge stop representing water levels farther into Pamlico Sound?
short: Coastal water levels
summary: >-
  Wind pushes water across the shallow sound and tilts its surface, so the level at a gauge on
  one shore can differ from the level tens of kilometers away. I use SWOT observations and NOAA
  gauges to test a nearest-gauge estimate on satellite passes withheld from the analysis.
status: In progress
region: Pamlico Sound, North Carolina
data:
  - SWOT water surface elevation
  - NOAA water-level gauges along the shoreline
  - Wind records for the times of the satellite passes
contribution: >-
  I designed the comparison. I process the SWOT water surface elevations over the sound, align
  them with the NOAA gauge records in time and in vertical reference, and run the evaluation.
baseline: >-
  The nearest-gauge estimate. Every location in the sound is assigned the water level recorded
  at the closest NOAA gauge at the time of the satellite pass.
test: >-
  Whole SWOT passes are withheld. For each withheld pass, the nearest-gauge estimate is compared
  with the SWOT elevations it did not see. Errors are summarized by distance from the gauge and
  by wind speed and direction. The distance at which the error exceeds the SWOT measurement
  noise is where the gauge stops being representative.
uncertain:
  - SWOT elevations are less reliable close to shore and over very calm water.
  - Satellite passes rarely coincide with the strongest winds, so the largest tilts are sampled least.
  - Gauges and SWOT report heights against different vertical references, and the offset between them has to be estimated.
  - The sound responds to wind with a delay and can keep oscillating after the wind drops. A single pass shows one moment of that response.
links:
  - label: 'SWOT mission (NASA JPL)'
    href: https://swot.jpl.nasa.gov/
  - label: 'NOAA Tides and Currents'
    href: https://tidesandcurrents.noaa.gov/
---

## Wind over a shallow sound

Pamlico Sound is broad and shallow. Astronomical tides are small away from the inlets, and
wind does most of the work. Sustained wind drags surface water downwind, lowering the level on
one shore and raising it on the other. The tilt grows with wind speed and with the distance the
wind blows over water, and it is larger where the water is shallow.

A gauge records the level at one point on the shore. When the surface is tilted, that reading
no longer describes the water tens of kilometers away.

## What SWOT adds

The Surface Water and Ocean Topography (SWOT) satellite measures water surface elevation
across two swaths, each about 50 km wide, on either side of a 20 km gap beneath the
spacecraft. A pass over the sound maps the surface at one moment, including open water that
no gauge samples.

## Data science decisions

- **Held-out unit.** Passes are withheld whole. Pixels within one pass are strongly correlated, so holding out random pixels would overstate accuracy.
- **Reference model.** The nearest-gauge estimate is what a practitioner would use today. Any interpolation or model has to beat it on withheld passes.
- **Error by condition.** Accuracy is reported by distance from the gauge and by wind, because the answer to the question is a distance that changes with the wind.
- **Vertical reference.** Gauge and satellite heights are brought to a common reference before any comparison.
