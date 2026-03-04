# bugs
- login and logout
- [/] 3d visualization re-render every time when clicked on any file, it should not re-render
- [/] fix ui bugs of raw code when add lines, wraps
- [/] right now it fake load when load new project, fix it
- [/] complexity of the function is not correct (some are not visible in the frontend) need to use cognitive complexity not cyclomatic complexity

# features left to implement
- refactor
- ai for complexity reduce
- ai summarize for the file/project
- ai chatbot for the project
- add options to change the circle packing to bezier curve
- add "npx eslint" for js and "pylint" for python to calculate the code quality score and get linting errors
- [/] backend need to give code quality score as well as detail to use it as color in frontend and description
- [/] increase the speed of timeline play for 3d by optimization
- [/] visulization of fucntions in each file as a table form (show the sub functions too)
- [/] for global functions, display the whole file
- [/] add contributor floating around the island 
- [/] add a timeline play for 3d visualization (play from yesterday, 1 week ago, 2 weeks ago)
- [/] add more col to the table view to include the maintainability index and other info.
- [/] show the number of total files in and add ability to select only top (50,100,250,500,1000,All) cognitive complexity files to visualize, or select the which directory (root, ...) also consider to if we change the repo or play the timeline 3d, we need to update the possible options and the count of files too

repo demo result
[Timeline] Animation Complete
            Total Commits: 39
            Total Time: 53363.00ms
            Average Time per Commit: 1142.17ms

[Timeline] Animation Complete
            Total Commits: 39
            Total Time: 5153.30ms
            Average Time per Commit: 97.05ms