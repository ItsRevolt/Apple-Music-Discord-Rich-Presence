const std = @import("std");
const ws = @import("websocket");
const rich_presence = @import("rich_presence.zig");

pub const App = struct {
    rich_presence_client: *rich_presence.RichPresenceClient,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator, rp_client: *rich_presence.RichPresenceClient) App {
        return App{
            .rich_presence_client = rp_client,
            .allocator = allocator,
        };
    }
};

pub const Handler = struct {
    app: *App,
    conn: *ws.Conn,

    pub fn init(_: *ws.Handshake, conn: *ws.Conn, app: *App) !Handler {
        std.log.info("🔌 Client connected\n", .{});
        return .{ .app = app, .conn = conn };
    }

    pub fn clientMessage(self: *Handler, data: []const u8) !void {
        std.log.info("📨 Received: {s}\n", .{data});

        var parsed = std.json.parseFromSlice(rich_presence.WebSocketMessage, self.app.allocator, data, .{}) catch |err| {
            std.log.err("❌ Failed to parse JSON: {}\n", .{err});
            return;
        };
        defer parsed.deinit();

        self.app.rich_presence_client.applyMessage(parsed.value);
    }

    pub fn close(self: *Handler) void {
        std.log.info("🔌 Client disconnected\n", .{});
        self.app.rich_presence_client.clearRichPresence();
    }
};

pub fn startServer(allocator: std.mem.Allocator, rp_client: *rich_presence.RichPresenceClient) !void {
    var server = try ws.Server(Handler).init(allocator, .{
        .port = 9224,
        .address = "127.0.0.1",
        .handshake = .{
            .timeout = 3,
            .max_size = 1024,
            .max_headers = 0,
        },
    });

    var app = App.init(allocator, rp_client);

    std.log.info("🚀 Server listening on ws://127.0.0.1:9224\n", .{});

    try server.listen(&app);
}
