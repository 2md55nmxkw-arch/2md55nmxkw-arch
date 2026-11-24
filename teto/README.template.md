<!--
  This README is generated. Edit teto/README.template.md and teto/config.json, then run:
    pip install fonttools brotli && python teto/build.py
  Actions rebuild it every day (teto-daily) and when someone talks to Teto (teto-issue).

  The banner, Teto's lines, the counter and the 0401 marks follow her mood (fed, hungry, birthday).
  Every piece comes in a dark and a light version and <picture> shows the one for the reader's
  GitHub theme. Full-width pieces keep their own height and reflow for narrow screens by themselves.
  Each block is one <p>: GitHub puts 16px under it, the rest of the spacing is inside the images.
-->

<p align="center">
  {{banner}}
</p>

<p align="center">
  {{dialogue}}
</p>

<p align="center">
  {{buttons}}
  <br>
  {{counter}}{{guests}}
</p>

<p>
  {{sep_projects}}
</p>

<p>
  {{rows}}
</p>

{{activity_section}}<p>
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
