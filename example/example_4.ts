// import PaperspaceApi from "paperspace-api-ts";
import PaperspaceApi from "../src";
import { PaperspaceClient, WaitTimeout } from "../src/client";

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

  let {
    body: { id: jobId }
  } = await paperClient.JobsCreate({
    container: "container",
    projectId: "projectId"
  });

  try {
    await PaperspaceClient.WaitFor(
      () => paperClient.GetJob({ jobId }),
      ({ body: { state } }) => state === "Running",
      { delay: 3000, retry: 10 }
    );
  } catch (e) {
    if (e instanceof WaitTimeout) {
      console.error(`Job ${{ jobId }} timeout error`);
      console.error(e);
    } else {
      console.error(`Unknown error.`, e);
    }
  }

  await paperClient.JobsStop({ jobId });
  await paperClient.JobsDestroy({ jobId });
})().catch(e => console.error(e));
