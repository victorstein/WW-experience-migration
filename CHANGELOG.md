# Changelog

## [1.3.0](https://github.com/victorstein/WW-experience-migration/compare/v1.2.0...v1.3.0) (2026-06-23)


### Features

* **web:** persist selected variant tab in the URL ([#27](https://github.com/victorstein/WW-experience-migration/issues/27)) ([4e0f45c](https://github.com/victorstein/WW-experience-migration/commit/4e0f45c564dba0c4d4319194694284db8341b556))

## [1.2.0](https://github.com/victorstein/WW-experience-migration/compare/v1.1.0...v1.2.0) (2026-06-23)


### Features

* French markets use /ateliers gateway slug (CA/FR, BE/FR, FR) ([#25](https://github.com/victorstein/WW-experience-migration/issues/25)) ([75f2279](https://github.com/victorstein/WW-experience-migration/commit/75f227972591de60e0a8ba3497420851d2835d8b))

## [1.1.0](https://github.com/victorstein/WW-experience-migration/compare/v1.0.0...v1.1.0) (2026-06-22)


### Features

* annotate nginx cells with 'old workshop finder' ([#8](https://github.com/victorstein/WW-experience-migration/issues/8)) ([99b4857](https://github.com/victorstein/WW-experience-migration/commit/99b48576f98283412a65af13e9739e5208135629))
* capture x-vercel-id/via/x-served-by to make 'other' self-explaining ([#3](https://github.com/victorstein/WW-experience-migration/issues/3)) ([ef048bd](https://github.com/victorstein/WW-experience-migration/commit/ef048bd886f0e59ecdcadf1e9ce88654ff9e7b96))
* click-through status pills + persist Server header to debug 'other' ([#2](https://github.com/victorstein/WW-experience-migration/issues/2)) ([a6619f4](https://github.com/victorstein/WW-experience-migration/commit/a6619f44574e954ac62a283fae9d2b2b4a42d88d))
* distinguish Vercel oops-404 from Drupal legacy-404 ([#15](https://github.com/victorstein/WW-experience-migration/issues/15)) ([249213c](https://github.com/victorstein/WW-experience-migration/commit/249213c980973cdd5daa668c5af1f5646d8950de))
* flag Vercel 200s that aren't the workshop page (vercel-wrong) ([#20](https://github.com/victorstein/WW-experience-migration/issues/20)) ([e26489d](https://github.com/victorstein/WW-experience-migration/commit/e26489d33f04b36f32ba3908aca4449a797011af))
* keep the matrix column headers sticky while scrolling ([#21](https://github.com/victorstein/WW-experience-migration/issues/21)) ([a0a217f](https://github.com/victorstein/WW-experience-migration/commit/a0a217fa808284120664064887ebbe149ae9ae85))
* responsive layout for phones + tablets ([#14](https://github.com/victorstein/WW-experience-migration/issues/14)) ([6c6ed5f](https://github.com/victorstein/WW-experience-migration/commit/6c6ed5f46afd3a69053701642dfa7217153d38f1))
* shared 'Refresh all' cooldown + edge-cached status polling ([#9](https://github.com/victorstein/WW-experience-migration/issues/9)) ([3f25763](https://github.com/victorstein/WW-experience-migration/commit/3f2576351fdc2ba6334543fc9098483e641cdd80))
* workshops status board (Worker + D1 + React dashboard) + CI/deploy ([#1](https://github.com/victorstein/WW-experience-migration/issues/1)) ([542c03c](https://github.com/victorstein/WW-experience-migration/commit/542c03c27123f4797044ff81a102144b5098cddd))


### Bug Fixes

* /api/history returns 400 on missing params (was 500) ([#12](https://github.com/victorstein/WW-experience-migration/issues/12)) ([dca078b](https://github.com/victorstein/WW-experience-migration/commit/dca078b203272288ef081ff9fc2845883fd5b961))
* align tooltip fingerprints in a key/value grid ([#4](https://github.com/victorstein/WW-experience-migration/issues/4)) ([d29ec16](https://github.com/victorstein/WW-experience-migration/commit/d29ec16d56b23ad0467862604a52c8548b096031))
* BE/NL Dutch coach slug + CA/FR French event word (virtuel) ([#22](https://github.com/victorstein/WW-experience-migration/issues/22)) ([8eb47d4](https://github.com/victorstein/WW-experience-migration/commit/8eb47d43d66789aedaf98c50234b51e7d587db8d))
* CA/FR tracks canonical trouver-un-atelier (was legacy trouvez-) ([#13](https://github.com/victorstein/WW-experience-migration/issues/13)) ([fc6f62b](https://github.com/victorstein/WW-experience-migration/commit/fc6f62baf3fa6cfc0556ca474b7d76872d7553fb))
* correct CA/FR coach slug to /parcourir-ww-coachs ([#18](https://github.com/victorstein/WW-experience-migration/issues/18)) ([7f7ac23](https://github.com/victorstein/WW-experience-migration/commit/7f7ac23a0f5d1fce0f643d89bdf46f039bd12b78))
* detect cached Vercel oops-404 via x-vercel-cache/x-matched-path ([#16](https://github.com/victorstein/WW-experience-migration/issues/16)) ([219530d](https://github.com/victorstein/WW-experience-migration/commit/219530d1b75000f674df1ad53b47dd5095144941))
* detect legacy nginx from the Cloudflare edge (Server is masked there) ([#7](https://github.com/victorstein/WW-experience-migration/issues/7)) ([9e89f23](https://github.com/victorstein/WW-experience-migration/commit/9e89f239523804d7af97573070b8a4095e39e582))
* drop misleading 'server: cloudflare' from the tooltip ([#11](https://github.com/victorstein/WW-experience-migration/issues/11)) ([80df5de](https://github.com/victorstein/WW-experience-migration/commit/80df5deec7f18a96aef8d1d22914ee623233cdce))
* hide horizontal scrollbar on the variant tabs ([#17](https://github.com/victorstein/WW-experience-migration/issues/17)) ([d1e35a6](https://github.com/victorstein/WW-experience-migration/commit/d1e35a61f7e8b2d0ff7b66eff7fbe0c65e38d76d))
* render multi-value tooltip headers one entry per line ([#6](https://github.com/victorstein/WW-experience-migration/issues/6)) ([3d2e983](https://github.com/victorstein/WW-experience-migration/commit/3d2e983d666c53b3c82cebe57f354db027743adf))
* report deep redirect funnels as 'redirect', not 'error' (AU /workshops) ([#10](https://github.com/victorstein/WW-experience-migration/issues/10)) ([5effc08](https://github.com/victorstein/WW-experience-migration/commit/5effc0885bf4789ed4a89d4c346229e78be2be30))
* stop browser caching /api/status so the board doesn't show stale data ([#19](https://github.com/victorstein/WW-experience-migration/issues/19)) ([4ed6b5c](https://github.com/victorstein/WW-experience-migration/commit/4ed6b5c18436e5ec27a456b0563cf4fea1a3460f))
* wrap tooltip fingerprint values at commas, not mid-token ([#5](https://github.com/victorstein/WW-experience-migration/issues/5)) ([2f05a8a](https://github.com/victorstein/WW-experience-migration/commit/2f05a8a14403082b9f89f2b5cdde317bd9b49290))
