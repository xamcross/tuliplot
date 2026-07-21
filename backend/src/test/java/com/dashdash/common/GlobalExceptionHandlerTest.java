package com.dashdash.common;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsIllegalArgumentToBadRequest() {
        ResponseEntity<ApiError> response =
                handler.handleIllegalArgument(new IllegalArgumentException("bad input"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("bad_request");
        assertThat(response.getBody().message()).isEqualTo("bad input");
    }

    @Test
    void mapsResponseStatusExceptionToItsStatus() {
        ResponseStatusException ex = new ResponseStatusException(HttpStatus.NOT_FOUND, "missing");

        ResponseEntity<ApiError> response = handler.handleResponseStatus(ex);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("not_found");
        assertThat(response.getBody().message()).isEqualTo("missing");
    }
}
