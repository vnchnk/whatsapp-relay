import "dotenv/config";
import { connect } from "./socket.js";
import { startRelay } from "./relay.js";
import { startServer } from "./server.js";

startServer();
connect((sock) => startRelay(sock));
