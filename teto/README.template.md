<!--
  This README is generated. Edit teto/README.template.md and teto/config.json, then run:
    pip install fonttools brotli && python teto/build.py
  Actions rebuild it every day (teto-daily) and when someone talks to Teto (teto-issue).
-->

<picture>
  <source media="(prefers-reduced-motion: reduce)" srcset="./assets/teto/banner-static.png">
  <img src="./assets/teto/banner.webp" width="100%" alt="Kasane Teto pressed against the glass of your screen, project cards floating around her">
</picture>

<p align="center">
  <img src="{{dialogue}}" width="100%" alt="{{alt_dialogue}}">
</p>

<p align="center">
  <a href="{{issue_feed}}"><img src="{{btn_feed}}" height="32" alt="{{alt_btn_feed}}"></a>
  <a href="{{issue_news}}"><img src="{{btn_news}}" height="32" alt="{{alt_btn_news}}"></a>
  <a href="{{issue_poke}}"><img src="{{btn_poke}}" height="32" alt="{{alt_btn_poke}}"></a>
  <br>
  <img src="{{counter}}" width="100%" alt="{{alt_counter}}">
</p>

<br>

<details open>
<summary><img src="{{sep_projects}}" width="95%" alt="Projects"></summary>
<br>

{{rows}}

</details>

<br>

<details open>
<summary><img src="{{sep_stack}}" width="95%" alt="Stack"></summary>
<br>
<p align="center">
  <img src="{{stack}}" width="71%" alt="{{alt_stack}}">
</p>
</details>

<br>

<p align="center">
  <img src="{{footer}}" width="100%" alt="{{alt_footer}}">
</p>
