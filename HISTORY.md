This is just for the grader. I tried to document some of the steps I took.

While reading the PDF and comprehending it, I dumped the prompt into Claude chat and told it. This is fairly large and I don't do loop programming regularly yet, so I want to not waste my time today and I had it chop up the task.

"Help me start this task. I want either a good prompt to feed into Claude Code or a sequence of smaller prompts for Claude Code that will produce the highest quality result."

After finishing reading the full PDF and forming some ideas, I edited the generated `CLAUDE.md` to try to set the intention of what I want to build and what the APIs and datamodels will look like. I've taken some liberties to keep soft deletes because I would want to set up the project on the right foot as I know later engineers are more likely to follow than to setup new patterns and this will drive me crazy later if it's missing.

Similarly for all modify, delete. I think they should be there and not added when needed even when not asked for.

Built the backend.

Build some start of the frontend.

... some time later ...

Surprised that it already chose colorblind friendly colors. I was going to tell it to do that given the prevelance.

Worked through a bit of polish on the colors though as it was kind of unusably bad with two of the labeling colors being nearly the same. Also added some color to the legend, so you can easily see what's what. Improved contrast between other labels as well.