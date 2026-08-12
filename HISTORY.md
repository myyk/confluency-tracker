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

Got claude to add the well measurement updating UI. It seems to be working with manual testing which confirms the backend tests visually.

I had it update the default value for a smoother updating experience.

Possible alternative: Move the new measurment UI right into the Plate UI.

I finished all that in about 3h30m give or take. (I need to look at timestamps to confirm, it was close to this. TBH I got a lot of texting done while doing this.)

Day 2: 4pm - I want to just review everything hit the mark. I immediately thought it did not nail "A scientist should be able to get a clear overview of cell growth within each well of a plate". I think with practice, yes, but like it's not as intuitive as it could be. It should convey that right away. I think a pi chart in addition would help. Alternatively, could be more of a cell density but I think it wouldn't be obvious what too much and too little would look like. This could be done with a pi chart.

I would also want to allow them to delete a measurement. It wasn't asked for but it feels missing.

Also, I want to move the recordering of a measurement into the well if it doesn't feel to busy.