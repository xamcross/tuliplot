package com.dashdash.catalog;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class CatalogSeeder implements ApplicationRunner {

    private final CatalogAppRepository repository;

    public CatalogSeeder(CatalogAppRepository repository) {
        this.repository = repository;
    }

    static List<CatalogApp> seedData() {
        return List.of(
                app("gmail", "Gmail", "https://mail.google.com",
                        "https://mail.google.com/favicon.ico", "Email", 0, Compatibility.LOGIN_IN_TAB),
                app("outlook", "Outlook", "https://outlook.office.com/mail",
                        "https://outlook.office.com/favicon.ico", "Email", 1, Compatibility.LOGIN_IN_TAB),
                app("trello", "Trello", "https://trello.com",
                        "https://trello.com/favicon.ico", "Productivity", 0, Compatibility.NEEDS_EXTENSION),
                app("notion", "Notion", "https://www.notion.so",
                        "https://www.notion.so/favicon.ico", "Productivity", 1, Compatibility.NEEDS_EXTENSION),
                app("todoist", "Todoist", "https://app.todoist.com",
                        "https://todoist.com/favicon.ico", "Productivity", 2, Compatibility.NEEDS_EXTENSION),
                app("gcal", "Google Calendar", "https://calendar.google.com",
                        "https://calendar.google.com/favicon.ico", "Productivity", 3, Compatibility.REFUSES_FRAME),
                app("hackernews", "Hacker News", "https://news.ycombinator.com",
                        "https://news.ycombinator.com/favicon.ico", "News", 0, Compatibility.FRAMES_CLEAN),
                app("youtube", "YouTube", "https://www.youtube.com",
                        "https://www.youtube.com/favicon.ico", "Media", 0, Compatibility.NEEDS_EXTENSION)
        );
    }

    private static CatalogApp app(String id, String name, String url, String iconUrl,
                                  String category, int order, Compatibility compatibility) {
        CatalogApp a = new CatalogApp();
        a.setId(id);
        a.setName(name);
        a.setUrl(url);
        a.setIconUrl(iconUrl);
        a.setCategory(category);
        a.setOrder(order);
        a.setCompatibility(compatibility);
        return a;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (CatalogApp a : seedData()) {
            if (!repository.existsById(a.getId())) {
                repository.save(a);
            }
        }
    }
}
