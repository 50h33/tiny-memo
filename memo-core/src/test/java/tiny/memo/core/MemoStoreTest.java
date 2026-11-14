package tiny.memo.core;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class MemoStoreTest {
    @TempDir
    Path directory;

    @Test
    void missingFileIsEmptyWithoutCreatingAFile() throws IOException {
        Path file = directory.resolve("missing/memo.txt");

        assertEquals("", new MemoStore(file).read());
        assertFalse(Files.exists(file));
    }

    @Test
    void savePersistsForANewStoreInstance() throws IOException {
        Path file = directory.resolve("data/memo.txt");
        new MemoStore(file).save("first memo");

        assertEquals("first memo", Files.readString(file, StandardCharsets.UTF_8));
        assertEquals("first memo", new MemoStore(file).read());
    }

    @Test
    void saveOverwritesTheWholeFileIncludingWithEmptyContent() throws IOException {
        Path file = directory.resolve("memo.txt");
        MemoStore store = new MemoStore(file);
        store.save("a much longer previous memo");
        store.save("short");

        assertEquals("short", new MemoStore(file).read());
        assertEquals(5, Files.size(file));

        store.save("");
        assertEquals("", new MemoStore(file).read());
        assertEquals(0, Files.size(file));
        try (var files = Files.list(directory)) {
            assertEquals(1, files.count());
        }
    }

    @Test
    void preservesKoreanNewlinesWhitespaceAndUtf8Bytes() throws IOException {
        Path file = directory.resolve("메모.txt");
        String content = "  안녕하세요 📝\n두 번째 줄\r\n\n끝 공백  \n";
        new MemoStore(file).save(content);

        assertEquals(content, new MemoStore(file).read());
        assertArrayEquals(content.getBytes(StandardCharsets.UTF_8), Files.readAllBytes(file));
    }
}
