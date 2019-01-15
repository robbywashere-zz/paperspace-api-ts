// import PaperspaceApi from "paperspace-api-ts";
import PaperspaceApi from "../src";
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

  const { body: templates } = await paperClient.TemplatesList();

  const label = "Ubuntu 14.04 Server";

  const templateId = (templates.find(t => t.label === label) || { id: null })
    .id;

  if (!templateId) throw new Error(`Error: '${label}' template not found.`);

  const {
    body: { id: machineId }
  } = await paperClient.MachinesCreate({
    region: "East Coast (NY2)",
    machineType: "C1",
    size: 50,
    billingType: "hourly",
    machineName: "Test Machine",
    templateId
  });

  await PaperspaceClient.WaitFor(
    () => paperClient.GetMachine({ machineId }),
    ({ body: { state } }) => state === "ready"
  );

  await paperClient.MachinesStop({ machineId });

  await paperClient.MachinesDestroy({ machineId });
})().catch(e => console.error(e));
