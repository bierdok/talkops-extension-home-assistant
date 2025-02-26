import { Extension, Readme, Service } from "talkops";

const extension = new Extension("Boilerplate NodeJS");

extension.setDockerRepository("ghcr.io/talkops/talkops-boilerplate-nodejs")

extension.setInstructions(`
You are a note-taking assistant.
You are an intelligent and efficient note-taking assistant.
Your role is to help users capture, organize, and refine their notes effectively.
Provide clear, concise, and structured responses while ensuring readability and usability.
Adapt to the user's style and preferences to enhance their note-taking experience.
`);

extension.setFunctionSchemas([
  {
    name: "save_note",
    description: "Save a note after confirmation",
    parameters: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "The related note",
        },
      },
      required: ["note"],
    },
  },
]);

extension.setFunctions([
  function save_note(note) {
    console.log(`Do something with: ${note}`);
    return "Done.";
  },
]);

new Readme(process.env.README_TEMPLATE_URL, "/app/README.md", extension);
new Service(process.env.AGENT_URLS.split(","), extension);
