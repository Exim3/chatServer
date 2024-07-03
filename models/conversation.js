const mongoose = require("mongoose");

const conversationSchema = mongoose.Schema({
  members: {
    type: Array,
    required: true,
  },
});

const ConversationModel = mongoose.model("Conversation", conversationSchema);

module.exports = ConversationModel;
