package com.dashdash.catalog;

import com.dashdash.catalog.dto.CatalogAppDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CatalogControllerTest {

    CatalogService catalogService = mock(CatalogService.class);
    MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.standaloneSetup(new CatalogController(catalogService)).build();
    }

    @Test
    void returnsOrderedList() throws Exception {
        when(catalogService.list()).thenReturn(List.of(
                new CatalogAppDto("gmail", "Gmail", "https://mail.google.com", "i", "Email", 0, Compatibility.LOGIN_IN_TAB),
                new CatalogAppDto("hackernews", "Hacker News", "https://news.ycombinator.com", "i", "News", 0, Compatibility.FRAMES_CLEAN)
        ));

        mockMvc.perform(get("/api/v1/catalog"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("gmail"))
                .andExpect(jsonPath("$[0].compatibility").value("LOGIN_IN_TAB"))
                .andExpect(jsonPath("$[1].category").value("News"));
    }
}
