package com.tuliplot.auth.dto;

import jakarta.validation.constraints.Email;

public record PasswordResetRequest(@Email String email) {}
