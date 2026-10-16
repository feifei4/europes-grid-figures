# Europe's Grid · figures

Interactive isometric figures for the *Europe's Grid* newsletter, published with GitHub Pages.

| Figure | Page | Source |
|---|---|---|
| Fig 1 · EPR, one loop | [`pwr-loop/`](pwr-loop/) (light), [`pwr-loop/dark.html`](pwr-loop/dark.html) | `src/pwr-loop/build.mjs` |

Each page is a standalone HTML file: the drawing kit is inlined, so there is nothing to install to view it.

## Building

The figures are made with the [Anatomy](https://github.com/wheresryan22/anatomy) skill. A build script imports the kit from the skill's folder (`../kit` next to the figure folder), so to rebuild one:

```sh
git clone https://github.com/wheresryan22/anatomy ~/.agents/skills/anatomy
mkdir -p ~/dev/anatomy-figures && cd ~/dev/anatomy-figures
ln -s ~/.agents/skills/anatomy/kit kit && ln -s ~/.agents/skills/anatomy/scripts scripts
cp -r <this repo>/src/pwr-loop pwr-loop && cd pwr-loop
node build.mjs --light          # writes pwr-loop-light.html
node build.mjs --light --audit  # proves the geometry
```

## Sources

Fig 1 uses the numbers in TVO's *Nuclear Power Plant Unit Olkiluoto 3* data sheet (AREVA data) and Table 5.1-1 of the US EPR Final Safety Analysis Report. The caption on the card lists them.
