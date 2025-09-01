const std = @import("std");
const rich_presence = @import("rich_presence.zig");
const server = @import("server.zig");
const c = @cImport({
    @cInclude("discord_partner_sdk.h");
});

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var rp_client = try rich_presence.RichPresenceClient.init(allocator, 1410153877831159808);
    std.log.info("🎮 Discord Rich Presence initialized\n", .{});

    const server_thread = try std.Thread.spawn(.{}, runWebSocketServer, .{ allocator, &rp_client });
    defer server_thread.join();

    // Discord SDK callback loop (10ms as recommended by Discord)
    while (true) {
        rp_client.runCallbacks();
        std.Thread.sleep(10 * std.time.ns_per_ms);
    }
}

fn runWebSocketServer(allocator: std.mem.Allocator, rp_client: *rich_presence.RichPresenceClient) !void {
    try server.startServer(allocator, rp_client);
}
