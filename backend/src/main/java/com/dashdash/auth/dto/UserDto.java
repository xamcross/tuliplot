package com.dashdash.auth.dto;

import com.dashdash.auth.Tier;

public record UserDto(String id, String email, String displayName, Tier tier, boolean adFree) {}
