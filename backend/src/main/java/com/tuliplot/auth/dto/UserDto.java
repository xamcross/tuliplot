package com.tuliplot.auth.dto;

import com.tuliplot.auth.Tier;

public record UserDto(String id, String email, String displayName, Tier tier, boolean adFree) {}
