package com.dashdash.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordResetConfirm(@NotBlank String token, @NotBlank String newPassword) {}
