# Smart City Traffic Signal Optimization Website

This is a static browser version of the traffic signal optimization project.

Open `index.html` in a browser to run it. Enter vehicle counts as comma-separated lane values, for example:

```text
16, 8, 11, 5
```

The website keeps the original greedy + priority queue scheduling idea, shows the same number of vehicles as the values entered, and includes emergency mode where only the selected emergency vehicle moves until it clears the road.
