---
order: 1
title: Can we measure gradual biomass gains as reliably as losses from a harvest?
short: Forest biomass
summary: >-
  A harvest removes most of a stand's biomass in one season, and almost any map detects it.
  A growing pine stand adds a few percent a year, which is smaller than the error of a typical
  biomass map. I connect North Carolina's aerial canopy-height maps and satellite embeddings
  with remeasured Forest Inventory and Analysis plots to find out how small a gain can be measured.
status: In progress
region: North Carolina Coastal Plain
data:
  - Aerial canopy-height maps of North Carolina
  - Annual satellite embeddings
  - Remeasured USDA Forest Inventory and Analysis (FIA) plots
contribution: >-
  I led the single-date biomass study that this project builds on. For the change study I am
  responsible for the design, the pipeline that joins canopy-height maps and satellite embeddings
  to remeasured FIA plots, the models, and the evaluation.
baseline: >-
  Map differencing. Biomass is estimated independently at two dates with the same single-date
  model, and the two maps are subtracted. This is the simplest approach and the one most
  regional biomass products support.
test: >-
  Remeasured FIA plots give the observed change on the ground. Whole plots are held out in
  spatial blocks, so neighboring plots never appear in both training and testing. Harvest losses
  and growth gains are scored separately. For gains, the estimate has to beat two simple
  references: no change, and the regional mean growth rate.
uncertain:
  - Plot visits and image acquisitions rarely fall in the same year, so the change seen by the plot and the change seen by the imagery cover different periods.
  - Canopy height responds to growth, but biomass also depends on stem density and wood volume that height does not capture.
  - Errors in two single-date estimates cancel only if they are shared between dates. How much they are shared is not known in advance.
  - Whether satellite embeddings carry a growth signal beyond what canopy height already provides is an open question in this study.
links:
  - label: 'Paper: single-date biomass mapping (Landscape Ecology, 2026)'
    href: https://doi.org/10.1007/s10980-026-02377-0
  - label: 'Code: supporting analysis for the paper'
    href: https://github.com/ChaoEcohydroRS/NC_SoutheastBiomass
  - label: 'Data: Zenodo archive for the paper'
    href: https://doi.org/10.5281/zenodo.18688899
---

## Biomass at one date

A biomass map for a single year is judged against plots that range from recently planted
stands to mature forest. The differences between stands are large, so a model that explains
them can score well even when its error at any one location is tens of megagrams per hectare.

In southeastern North Carolina, we mapped above-ground biomass over about 10,500 km² with
optical, radar, and photogrammetric predictors and 305 FIA plots. Adding canopy-height
profiles derived from aerial imagery gave the largest gain in accuracy, lowering the
normalized error by 15.9 to 18.0 percent relative to the multi-sensor baseline
([Wang et al., 2026](https://doi.org/10.1007/s10980-026-02377-0)).

## Change between two dates

Change is the difference between two such estimates at the same place. A clearcut removes
most of the biomass at once, and that loss is far larger than the map error. Growth is
different. A pine stand in the Coastal Plain adds biomass slowly, and over the several years
between plot visits the gain can be about the same size as the error in either map.
Subtracting two maps also adds their errors together unless the errors are shared between dates.

For this reason a single accuracy number is misleading. It is dominated by harvests, which are
easy, and says little about growth, which is most of the landscape in most years.

## Machine learning decisions

- **Reference data.** Remeasured plots are the only direct observation of change on the ground, so they define both the training target and the test.
- **Predictors.** Canopy-height maps describe structure at each acquisition. Satellite embeddings summarize a year of imagery in a compact vector. The study asks what each adds for change.
- **Validation.** Spatial blocks keep nearby plots together, and gains and losses are reported separately.
- **Reference models.** A method is useful for growth only if it beats predicting no change and predicting the regional mean.
