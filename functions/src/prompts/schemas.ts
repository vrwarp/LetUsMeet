export const TIME_SLOTS_SCHEMA = {
  name: "time_slots_response",
  schema: {
    type: "object",
    properties: {
      reasoning: { type: "string" },
      time_slots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            start_time: { type: "string" },
            end_time: { type: "string" },
          },
          required: ["date", "start_time", "end_time"],
          additionalProperties: false,
        },
      },
    },
    required: ["reasoning", "time_slots"],
    additionalProperties: false,
  },
};

export const FUZZY_SLOTS_SCHEMA = {
  name: "fuzzy_slots_response",
  schema: {
    type: "object",
    properties: {
      reasoning: { type: "string" },
      fuzzy_slots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            label: { type: "string" },
            time: { type: "string" },
          },
          required: ["date", "label", "time"],
          additionalProperties: false,
        },
      },
    },
    required: ["reasoning", "fuzzy_slots"],
    additionalProperties: false,
  },
};
