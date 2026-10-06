import { defineRailway, github, project, service } from "railway/iac";

export default defineRailway(() => {
  const web = service("web", {
    source: github("unserrer1977/angel-investor-survey"),
    start: "node server.js",
  });

  return project("survey-repo", {
    resources: [web],
  });
});
