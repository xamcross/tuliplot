package com.tuliplot.dashboard;

import com.tuliplot.auth.DashPrincipal;
import com.tuliplot.dashboard.dto.CellDto;
import com.tuliplot.dashboard.dto.DashboardDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardControllerTest {

    DashboardService service = mock(DashboardService.class);
    MockMvc mockMvc;

    @BeforeEach
    void setup() {
        HandlerMethodArgumentResolver principalResolver = new HandlerMethodArgumentResolver() {
            @Override
            public boolean supportsParameter(MethodParameter p) {
                return DashPrincipal.class.isAssignableFrom(p.getParameterType());
            }
            @Override
            public Object resolveArgument(MethodParameter p, ModelAndViewContainer m,
                                          NativeWebRequest w, WebDataBinderFactory b) {
                return new DashPrincipal() {
                    @Override public String getUserId() { return "u1"; }
                    @Override public String getEmail() { return "u1@example.com"; }
                };
            }
        };
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(new DashboardController(service))
                .setCustomArgumentResolvers(principalResolver)
                .setValidator(validator)
                .build();
    }

    private static String cell(int slot, String type) {
        return "{\"slot\":" + slot + ",\"type\":\"" + type + "\",\"url\":null,\"title\":null,"
                + "\"catalogAppId\":null,\"iconUrl\":null,\"openMode\":\"FRAME\"}";
    }

    private static String body(List<String> cells) {
        return "{\"cells\":[" + String.join(",", cells) + "]}";
    }

    @Test
    void put_wrongSlotCount_returns400() throws Exception {
        List<String> five = IntStream.range(0, 5).mapToObj(i -> cell(i, "EMPTY")).collect(Collectors.toList());
        mockMvc.perform(put("/api/v1/dashboard/cells")
                        .contentType("application/json").content(body(five)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void put_validFreeLayout_returns200() throws Exception {
        List<String> cells = new ArrayList<>();
        for (int i = 0; i < 5; i++) cells.add(cell(i, "EMPTY"));
        cells.add(cell(5, "AD"));
        List<CellDto> returned = new ArrayList<>();
        for (int i = 0; i < 5; i++) returned.add(new CellDto(i, CellType.EMPTY, null, null, null, null, OpenMode.FRAME));
        returned.add(new CellDto(5, CellType.AD, null, null, null, null, OpenMode.FRAME));
        when(service.updateCells(eq("u1"), any())).thenReturn(new DashboardDto(returned, null));

        mockMvc.perform(put("/api/v1/dashboard/cells")
                        .contentType("application/json").content(body(cells)))
                .andExpect(status().isOk());
    }

    @Test
    void put_invariantViolation_returns422() throws Exception {
        List<String> cells = IntStream.range(0, 6).mapToObj(i -> cell(i, "EMPTY")).collect(Collectors.toList());
        when(service.updateCells(eq("u1"), any())).thenThrow(new InvalidCellsException("bad"));

        mockMvc.perform(put("/api/v1/dashboard/cells")
                        .contentType("application/json").content(body(cells)))
                .andExpect(status().isUnprocessableEntity());
    }
}
