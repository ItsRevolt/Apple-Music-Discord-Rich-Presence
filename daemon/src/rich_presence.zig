const std = @import("std");

const c = @cImport({
    @cInclude("discord_partner_sdk.h");
});

pub const MessageType = enum {
    PLAYING,
    STOP,
};

pub const WebSocketMessage = struct {
    type: MessageType,
    state: ?[]const u8 = null,
    details: ?[]const u8 = null,
    large_image: ?[]const u8 = null,
    start_time: ?i64 = null,
    end_time: ?i64 = null,
};

pub const RichPresenceClient = struct {
    client: c.Discord_Client,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator, application_id: u64) !RichPresenceClient {
        var client: c.Discord_Client = std.mem.zeroInit(c.Discord_Client, .{});
        c.Discord_Client_Init(&client);
        c.Discord_Client_SetApplicationId(&client, application_id);

        c.Discord_Client_AddLogCallback(
            &client,
            logCallback,
            null,
            null,
            c.Discord_LoggingSeverity_Info,
        );

        std.log.info(
            "Discord SDK version: {d}.{d}.{d}\n",
            .{
                c.Discord_Client_GetVersionMajor(),
                c.Discord_Client_GetVersionMinor(),
                c.Discord_Client_GetVersionPatch(),
            },
        );

        return RichPresenceClient{ .client = client, .allocator = allocator };
    }

    pub fn applyMessage(self: *RichPresenceClient, msg: WebSocketMessage) void {
        switch (msg.type) {
            .PLAYING => self.updateRichPresence(msg),
            .STOP => self.clearRichPresence(),
        }
    }

    fn updateRichPresence(self: *RichPresenceClient, msg: WebSocketMessage) void {
        var activity: c.Discord_Activity = std.mem.zeroInit(c.Discord_Activity, .{});
        c.Discord_Activity_Init(&activity);
        c.Discord_Activity_SetType(&activity, c.Discord_ActivityTypes_Listening);

        var state_string = createDiscordString(msg.state orelse "");
        c.Discord_Activity_SetState(&activity, &state_string);

        var details_string = createDiscordString(msg.details orelse "");
        c.Discord_Activity_SetDetails(&activity, &details_string);

        if (msg.large_image) |large_image| {
            var activity_assets: c.Discord_ActivityAssets = std.mem.zeroInit(c.Discord_ActivityAssets, .{});
            c.Discord_ActivityAssets_Init(&activity_assets);
            var large_image_string = createDiscordString(large_image);
            c.Discord_ActivityAssets_SetLargeImage(&activity_assets, &large_image_string);
            c.Discord_Activity_SetAssets(&activity, &activity_assets);
        }

        if (msg.start_time != null or msg.end_time != null) {
            var activity_timestamps: c.Discord_ActivityTimestamps = std.mem.zeroInit(c.Discord_ActivityTimestamps, .{});
            c.Discord_ActivityTimestamps_Init(&activity_timestamps);
            if (msg.start_time) |start_time| {
                c.Discord_ActivityTimestamps_SetStart(&activity_timestamps, @intCast(start_time));
            }
            if (msg.end_time) |end_time| {
                c.Discord_ActivityTimestamps_SetEnd(&activity_timestamps, @intCast(end_time));
            }
            c.Discord_Activity_SetTimestamps(&activity, &activity_timestamps);
        }

        c.Discord_Client_UpdateRichPresence(&self.client, &activity, updateCallback, null, null);
    }

    pub fn runCallbacks(self: *RichPresenceClient) void {
        _ = self;
        c.Discord_RunCallbacks();
    }

    pub fn clearRichPresence(self: *RichPresenceClient) void {
        c.Discord_Client_ClearRichPresence(&self.client);
    }
};

fn createDiscordString(text: []const u8) c.struct_Discord_String {
    return c.struct_Discord_String{
        .ptr = @constCast(text.ptr),
        .size = text.len,
    };
}

fn updateCallback(result: [*c]c.struct_Discord_ClientResult, user_data: ?*anyopaque) callconv(.c) void {
    _ = user_data;
    if (c.Discord_ClientResult_Successful(result)) {
        std.log.info("🎮 Rich Presence updated successfully!\n", .{});
    } else {
        std.log.info("❌ Rich Presence update failed\n", .{});
    }
}

fn logCallback(message: c.struct_Discord_String, severity: c_uint, user_data: ?*anyopaque) callconv(.c) void {
    _ = user_data;
    const sev_str = switch (severity) {
        c.Discord_LoggingSeverity_Info => "Info",
        c.Discord_LoggingSeverity_Warning => "Warning",
        c.Discord_LoggingSeverity_Error => "Error",
        else => "Unknown",
    };
    const msg_slice = message.ptr[0..message.size];
    std.log.info("[{s}] {s}\n", .{ sev_str, msg_slice });
}
