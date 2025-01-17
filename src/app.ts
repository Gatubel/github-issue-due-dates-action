import * as core from "@actions/core";
import { context } from "@actions/github";
import Octokit from "./integrations/Octokit";
import { datesToDue } from "./utils/dateUtils";
import { sendDueMail } from "./utils/emailUtils";
// import { OVERDUE_TAG_NAME, NEXT_WEEK_TAG_NAME } from "./constants";
import dotenv from "dotenv";

dotenv.config();

export const run = async () => {
  try {
    const githubToken = core.getInput("GH_TOKEN");
    if (!githubToken) {
      throw new Error("Missing GH_TOKEN environment variable");
    }

    const ok = new Octokit(githubToken);

    const issues = await ok.listAllOpenIssues(context.repo.owner, context.repo.repo);
    const results = await ok.getIssuesWithDueDate(issues);
    for (const issue of results) {
      const daysUtilDueDate = await datesToDue(issue.due);

      // Between 0 and 7 days until due date
      if (daysUtilDueDate <= 7 && daysUtilDueDate > 0 && process.env.NEXT_WEEK_TAG_NAME) {
        await ok.addLabelToIssue(context.repo.owner, context.repo.repo, issue.number, [
          process.env.NEXT_WEEK_TAG_NAME,
        ]);
      }
      // Issue is due
      if (daysUtilDueDate <= 0 && process.env.NEXT_WEEK_TAG_NAME && process.env.OVERDUE_TAG_NAME) {
        await ok.removeLabelFromIssue(
          context.repo.owner,
          context.repo.repo,
          process.env.NEXT_WEEK_TAG_NAME,
          issue.number,
        );
        await ok.addLabelToIssue(context.repo.owner, context.repo.repo, issue.number, [
          process.env.OVERDUE_TAG_NAME,
        ]);
        await sendDueMail();
      }
    }
    return {
      ok: true,
      issuesProcessed: results.length,
    };
  } catch (e: any) {
    core.setFailed(e.message);
    throw e;
  }
};

run();
