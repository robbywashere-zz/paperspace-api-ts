// import PaperspaceApi from "paperspace-api-ts";
import PaperspaceApi from "../src/api";
import { PaperspaceClient } from "../src/client";

(async function() {
  const paperClient = new PaperspaceApi(null, console);

  await paperClient
    .Authenticate({
      email: "paperspace@example.com",
      password: process.env.PASSWORD as string
    })
    .catch(e => {
      if (e.status === 401)
        throw new Error(`401: Could not login, check credentials.`);
      throw new Error(e);
    });

  PaperspaceClient.PollLogFn(({ line }) =>
    paperClient.JobsLogs({ jobId: "jobid", line })
  )
    .on("message", ({ line, message }) => console.log(`L${line}: ${message}`))
    .on("error", e => console.error("Fatal", e))
    .on("end", () => console.log("Pipe closed."))
    .on("pipeError", e => console.error(`Pipe Error: CODE ${e.status}`));
})().catch(e => console.error(e));
