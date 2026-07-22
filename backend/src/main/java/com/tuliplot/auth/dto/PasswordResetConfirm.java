package com.tuliplot.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record PasswordResetConfirm(@NotBlank String token, @NotBlank String newPassword) {}
