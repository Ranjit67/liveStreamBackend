const express = require("express");
const socket = require("socket.io");

const app = express();
const http = require("http");
const server = http.createServer(app);
const io = socket(server, {
  cors: {
    origin: "*",
  },
});
const hostFirstRoomIdA = {}; //including host soc.id and member
const hostSecondRoomId = {}; //host socketid
const idToHostFirstRoomId = {}; // soc.id host first room id
const firstToSecond = {};
const idToRoomId = {};
const roomToName = {};
const roomToHost = {};
const roomPubStatus = {};
// for client
const clientToName = {};
const clintToHost = {};
//
io.on("connection", (socket) => {
  // for host
  socket.on("cheack have an already or new", (payload) => {
    const { firstId, secondId, name } = payload;

    if (hostFirstRoomIdA[firstId] && hostSecondRoomId[secondId]) {
      const item = hostFirstRoomIdA[firstId].find(
        (id) => id === hostSecondRoomId[secondId]
      );
      if (item) {
        const newIds = hostFirstRoomIdA[firstId].filter(
          (f) => f !== hostSecondRoomId[secondId]
        );
        newIds.push(socket.id);
        hostFirstRoomIdA[firstId] = newIds;
        delete idToRoomId[hostSecondRoomId[secondId]];
        idToRoomId[socket.id] = firstId;
        delete idToHostFirstRoomId[hostSecondRoomId[secondId]];
        delete hostSecondRoomId[secondId];
        hostSecondRoomId[secondId] = socket.id;
        roomToHost[firstId] = socket.id;
        roomPubStatus[firstId] = true;
        socket.emit("Send course name", { courseName: roomToName[firstId] });
      }
    } else {
      roomPubStatus[firstId] = true;
      hostFirstRoomIdA[firstId] = [socket.id];
      hostSecondRoomId[secondId] = socket.id;
      idToRoomId[socket.id] = firstId;
      roomToName[firstId] = name;
      firstToSecond[firstId] = secondId;
      socket.emit("Send course name", { courseName: roomToName[firstId] });
    }
  });
  // host public status
  socket.on("user public status", (payload) => {
    const { public, roomId } = payload;
    if (public) {
      // host in public mood
      roomPubStatus[roomId] = true;
    } else {
      // host in private mood
      roomPubStatus[roomId] = false;
    }
  });
  //for client
  socket.on("client name send", (payload) => {
    const { name, roomId } = payload;

    const hostId = roomToHost[roomId];
    clientToName[socket.id] = name;
    if (roomPubStatus[roomId] && hostFirstRoomIdA[roomId]) {
      hostFirstRoomIdA[roomId].push(socket.id);
      clintToHost[socket.id] = roomToHost[roomId];

      io.to(hostId).emit("send for signal", { userId: socket.id });
    } else {
      if (!roomPubStatus[roomId] && hostFirstRoomIdA[roomId]) {
        io.to(hostId).emit("required permission of host", {
          clientId: socket.id,
          name,
        });
      } else {
        socket.emit("host not exit", "host is not exit.");
      }
    }
  });

  socket.on("permission status", (payload) => {
    const { clientId, permission } = payload;
    if (permission && clientToName[clientId]) {
      hostFirstRoomIdA[idToRoomId[socket.id]].push(clientId);
      clintToHost[clientId] = socket.id;
      // hostFirstRoomIdA[idToRoomId[socket.id]]

      io.to(clientId).emit("permission accept", {
        hostId: socket.id,
      });
    } else {
      if (!permission && clientToName[clientId]) {
        io.to(clientId).emit("permission reject", "Permission reject");
      } else {
        socket.emit("client is disconnected", "Client is disconnected");
      }
    }
  });
  socket.on("after accept send signal to client", (payload) => {
    io.to(payload.hostID).emit("send for signal", { userId: socket.id });
  });

  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });
  socket.on("sending signal", (payload) => {
    const courseName = roomToName[idToRoomId[socket.id]];

    io.to(payload.userToSignal).emit("user joined", {
      hostSignal: payload.signal,
      hostSelfId: payload.callerID,
      courseName,
    });
  });
  //get option
  socket.on("get option to client", (payload) => {
    const inThisRoom = hostFirstRoomIdA[idToRoomId[socket.id]].filter(
      (id) => id !== socket.id
    );

    inThisRoom.forEach((client) => {
      io.to(client).emit("client side option", { cOption: payload.option });
    });
  });
  socket.on("send result from client", (payload) => {
    const host = roomToHost[payload.room];
    const name = clientToName[socket.id];
    io.to(host).emit("send result to host", {
      optionData: payload.data,
      clientId: socket.id,
      name,
    });
  });
  socket.on("send result from host", (payload) => {
    const inThisRoom = hostFirstRoomIdA[idToRoomId[socket.id]].filter(
      (id) => id !== socket.id
    );

    inThisRoom.forEach((client) => {
      io.to(client).emit("result to client", { result: payload.data });
    });
  });
  socket.on("cheack this host is bloging or not", (payload) => {
    if (payload.hostLeaveID === payload.room) {
      delete clientToName[socket.io];
      delete clintToHost[socket.id];
      if (
        hostFirstRoomIdA[payload.room] &&
        hostFirstRoomIdA[payload.room].length === 1
      ) {
        delete hostFirstRoomIdA[payload.room];
        delete roomToName[payload.room];
        delete roomToHost[payload.room];
        delete roomPubStatus[payload.room];
        delete hostSecondRoomId[firstToSecond[payload.room]];
        delete firstToSecond[payload.room];
      } else if (
        hostFirstRoomIdA[payload.room] &&
        hostFirstRoomIdA[payload.room].length > 1
      ) {
        const romveClintId = hostFirstRoomIdA[payload.room].filter(
          (id) => id !== socket.id
        );
        hostFirstRoomIdA[payload.room] = romveClintId;
      }
      socket.emit("clint belong", "data");
    }
  });
  socket.on("remove the client", (payload) => {
    const memberHaveInRoom = hostFirstRoomIdA[payload.room].filter(
      (id) => id !== payload.removeId
    );
    hostFirstRoomIdA[payload.room] = memberHaveInRoom;
    delete clintToHost[payload.removeId];
  });

  socket.on("host leave", (payload) => {
    socket.broadcast.emit("host leave suddenly", {
      roomLeave: idToRoomId[socket.id],
    });
    delete idToRoomId[socket.id];
    delete idToHostFirstRoomId[socket.id];
  });
  socket.on("client leave", (payload) => {
    delete clientToName[socket.id];
    io.to(clintToHost[socket.id]).emit("one client leave", {
      clientId: socket.id,
    });
  });

  socket.on("disconnect", () => {
    //host leave

    if (idToRoomId[socket.id]) {
      socket.broadcast.emit("host leave suddenly", {
        roomLeave: idToRoomId[socket.id],
      });
      delete idToRoomId[socket.id];
      delete idToHostFirstRoomId[socket.id];
    }
    if (clientToName[socket.id]) {
      delete clientToName[socket.id];
      io.to(clintToHost[socket.id]).emit("one client leave", {
        clientId: socket.id,
      });
    }
  });
});

server.listen(process.env.PORT || 5000, () => {
  console.log("The port 5000 is ready to start");
});
