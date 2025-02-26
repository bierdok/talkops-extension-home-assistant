import { Extension, Readme, Service } from "talkops";

const extension = new Extension("Home Assistant");

extension.setDockerRepository(
  "ghcr.io/bierdok/talkops-extension-home-assistant"
);

extension.setDescription(`
This Extension based on [Home Assistant](https://www.home-assistant.io/) allows you to control connected devices by voice in **realtime**.
`);

extension.setInstallationGuide(`
* Open Home Assitant from a web browser with admin permissions.
* Open the \`Profile\` page by clicking on your username at the bottom left.
* Navigate to \`Security\` tab and scroll down to \`Long-lived access tokens\` card.
* Click on the button \`Create Token\`, called the token \`TalkOps\` and validate.
* Use the generated token to setup the environment variable \`ACCESS_TOKEN\`.
`);

extension.setEnvironmentVariables({
  WS_BASE_URL: {
    description: "The Web Socket base URL.",
    defaultValue: `ws://home-assistant:8123`,
  },
  ACCESS_TOKEN: {
    description: "The generated long-lived access token.",
  },
});

import floorsModel from "./schemas/models/floors.json" assert { type: "json" };
import roomsModel from "./schemas/models/rooms.json" assert { type: "json" };
import lightsModel from "./schemas/models/lights.json" assert { type: "json" };
import shuttersModel from "./schemas/models/shutters.json" assert { type: "json" };
import sensorsModel from "./schemas/models/sensors.json" assert { type: "json" };
import scenesModel from "./schemas/models/scenes.json" assert { type: "json" };

import updateLightsFunction from "./schemas/functions/update_lights.json" assert { type: "json" };
import enableScenesFunction from "./schemas/functions/enable_scenes.json" assert { type: "json" };
import updateShuttersFunction from "./schemas/functions/update_shutters.json" assert { type: "json" };

const baseInstructions = `
You are a home automation assistant, focused solely on managing connected devices in the home.
When asked to calculate an average, **round to the nearest whole number** without explaining the calculation.
`;

const defaultInstructions = `
Currently, there is no connected devices.
Your sole task is to ask the user to install one or more connected devices in the home before proceeding.
`;

import WebSocket from "ws";

let id = 1;
const types = new Map();
const units = new Map();
const states = new Map();
let floors = [];
let rooms = [];
let lights = [];
let shutters = [];
let sensors = [];
let scenes = [];

let socket = null;
let interval = null;

function call(type, params) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  socket.send(JSON.stringify({ type, id, ...params }));
  types.set(id, type);
  id++;
  return true;
}

function connect() {
  socket = new WebSocket(`${process.env.WS_BASE_URL}/api/websocket`);
  socket.onerror = (err) => {
    extension.errors = [err.message];
  };
  socket.onopen = () => {
    extension.errors = [];
    socket.send(
      JSON.stringify({
        type: "auth",
        access_token: process.env.ACCESS_TOKEN,
      })
    );
  };
  function refresh() {
    call("get_config");
    call("get_states");
    call("config/floor_registry/list");
    call("config/area_registry/list");
    call("config/entity_registry/list");
  }
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.type === "auth_ok") {
      extension.errors = [];
      refresh();
      interval = setInterval(refresh, 5000);
    }
    if (data.type === "auth_invalid") {
      extension.errors = [data.message];
    }
    if (data.type === "result" && data.success) {
      const type = types.get(data.id);
      if (type === "get_config") {
        extension.setVersion(data.result.version);
      }
      if (type === "get_states") {
        data.result.forEach((entity) => {
          states.set(entity.entity_id, entity.state);
        });
        data.result
          .filter(
            (entity) => entity.attributes.unit_of_measurement !== undefined
          )
          .forEach((entity) => {
            units.set(entity.entity_id, entity.attributes.unit_of_measurement);
          });
      }
      if (type === "config/floor_registry/list") {
        floors = data.result.map((floor) => {
          return {
            id: floor.floor_id,
            name: floor.name,
            level: floor.level,
          };
        });
      }
      if (type === "config/area_registry/list") {
        rooms = data.result.map((area) => {
          return {
            id: area.area_id,
            name: area.name,
            floor_id: area.floor_id,
          };
        });
      }
      if (type === "config/entity_registry/list") {
        lights = data.result
          .filter((entity) => entity.entity_id.startsWith("light"))
          .map((entity) => {
            return {
              id: entity.entity_id,
              name: entity.name || entity.original_name,
              state: states.get(entity.entity_id),
              area_id: entity.area_id,
            };
          });
        shutters = data.result
          .filter((entity) => entity.entity_id.startsWith("cover"))
          .map((entity) => {
            return {
              id: entity.entity_id,
              name: entity.name || entity.original_name,
              state: states.get(entity.entity_id),
              area_id: entity.area_id,
            };
          });
        sensors = data.result
          .filter(
            (entity) =>
              entity.entity_id.startsWith("sensor") &&
              states.get(entity.entity_id) &&
              units.get(entity.entity_id)
          )
          .map((entity) => {
            return {
              id: entity.entity_id,
              name: entity.name || entity.original_name,
              value: states.get(entity.entity_id),
              unit: units.get(entity.entity_id),
              area_id: entity.area_id,
            };
          });
        scenes = data.result
          .filter((entity) => entity.entity_id.startsWith("scene"))
          .map((entity) => {
            return {
              id: entity.entity_id,
              name: entity.name || entity.original_name,
              area_id: entity.area_id,
            };
          });
        if (type === "call_service") {
          console.log(data.result);
        }
      }

      extension.setInstructions(() => {
        const instructions = [];
        instructions.push(baseInstructions);

        if (!lights && !shutters && !sensors && !scenes) {
          instructions.push(defaultInstructions);
        }

        if (floors) {
          instructions.push("# The floors");
          instructions.push(`* Model: ${JSON.stringify(floorsModel)}`);
          instructions.push(`* Data: ${JSON.stringify(floors)}`);
        }

        if (rooms) {
          instructions.push("# The rooms");
          instructions.push(`* Model: ${JSON.stringify(roomsModel)}`);
          instructions.push(`* Data: ${JSON.stringify(rooms)}`);
        }

        if (lights) {
          instructions.push("# The lights");
          instructions.push(`* Model: ${JSON.stringify(lightsModel)}`);
          instructions.push(`* Data: ${JSON.stringify(lights)}`);
        }

        if (shutters) {
          instructions.push("# The shutters");
          instructions.push(`* Model: ${JSON.stringify(shuttersModel)}`);
          instructions.push(`* Data: ${JSON.stringify(shutters)}`);
        }

        if (sensors) {
          instructions.push("# The sensors");
          instructions.push(`* Model: ${JSON.stringify(sensorsModel)}`);
          instructions.push(`* Data: ${JSON.stringify(sensors)}`);
        }

        if (scenes) {
          instructions.push("# The scenes");
          instructions.push(`* Model: ${JSON.stringify(scenesModel)}`);
          instructions.push(`* Data: ${JSON.stringify(scenes)}`);
        }

        return instructions;
      });

      extension.setFunctionSchemas(() => {
        const functionSchemas = [];
        if (lights) {
          functionSchemas.push(updateLightsFunction);
        }
        if (scenes) {
          functionSchemas.push(enableScenesFunction);
        }
        if (shutters) {
          functionSchemas.push(updateShuttersFunction);
        }
        return functionSchemas;
      });
    }
  };
  socket.onclose = () => {
    interval && clearInterval(interval);
    setTimeout(connect, 1000);
    id = 1;
    floors = [];
    rooms = [];
    lights = [];
    shutters = [];
    sensors = [];
    scenes = [];
    extension.errors = ["Server unreachable"];
  };
}
connect();

extension.setFunctions([
  async function enable_scenes(ids) {
    for (const id of ids) {
      if (
        !call("call_service", {
          domain: "scene",
          service: "turn_on",
          target: {
            entity_id: id,
          },
        })
      ) {
        return "Error";
      }
    }
    return "Done.";
  },
  async function update_lights(action, ids) {
    for (const id of ids) {
      if (
        !call("call_service", {
          domain: "light",
          service: `turn_${action}`,
          target: {
            entity_id: id,
          },
        })
      ) {
        return "Error";
      }
    }
    return "Done.";
  },
  async function update_shutters(action, ids) {
    for (const id of ids) {
      if (
        !call("call_service", {
          domain: "cover",
          service: `${action}_cover`,
          target: {
            entity_id: id,
          },
        })
      ) {
        return "Error";
      }
    }
    return "Done.";
  },
]);

new Readme(process.env.README_TEMPLATE_URL, "/app/README.md", extension);
new Service(process.env.AGENT_URLS.split(","), extension);
