<!--
  This README is generated. Edit teto/README.template.md and teto/config.json, then run:
    pip install fonttools brotli && python teto/build.py
  Actions rebuild it every day (teto-daily) and when someone talks to Teto (teto-issue).

  Every piece comes in a dark and a light version and <picture> shows the one for the reader's
  GitHub theme. Full-width pieces keep their own height and reflow for narrow screens by themselves.
  Each block is one <p>: GitHub puts 16px under it, the rest of the spacing is inside the images.
-->

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light) and (prefers-reduced-motion: reduce)" srcset="./assets/teto/banner-light-static.png">
    <source media="(prefers-reduced-motion: reduce)" srcset="./assets/teto/banner-static.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/teto/banner-light.webp">
    <img src="./assets/teto/banner.webp" width="100%" alt="Kasane Teto pressed against the glass of your screen, project cards floating around her">
  </picture>
</p>

<p align="center">
  {{dialogue}}
</p>

<p align="center">
  {{buttons}}
  <br>
  {{counter}}
</p>

<p>
  {{sep_projects}}
</p>

<p>
  {{rows}}
</p>

<p>
  {{sep_stack}}
</p>

<p>
  {{stack}}
  <br>
  {{legend}}
</p>

<p align="center">
  {{footer}}
</p>
