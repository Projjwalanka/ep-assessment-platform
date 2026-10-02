package com.examdesk.model;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.List;
import java.util.Map;

/** JSON column converters: keeps the schema flat (no join tables) and the H2 file tiny. */
public final class JsonConverters {
    private JsonConverters() {}

    static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    public abstract static class Base<T> implements AttributeConverter<T, String> {
        private final TypeReference<T> type;

        protected Base(TypeReference<T> type) { this.type = type; }

        @Override
        public String convertToDatabaseColumn(T value) {
            try { return value == null ? null : MAPPER.writeValueAsString(value); }
            catch (Exception e) { throw new IllegalStateException("JSON write failed", e); }
        }

        @Override
        public T convertToEntityAttribute(String db) {
            try { return db == null || db.isBlank() ? null : MAPPER.readValue(db, type); }
            catch (Exception e) { throw new IllegalStateException("JSON read failed", e); }
        }
    }

    @Converter
    public static class StringList extends Base<List<String>> {
        public StringList() { super(new TypeReference<List<String>>() {}); }
    }

    @Converter
    public static class LongList extends Base<List<Long>> {
        public LongList() { super(new TypeReference<List<Long>>() {}); }
    }

    @Converter
    public static class IntMap extends Base<Map<String, Integer>> {
        public IntMap() { super(new TypeReference<Map<String, Integer>>() {}); }
    }

    @Converter
    public static class StringMap extends Base<Map<String, String>> {
        public StringMap() { super(new TypeReference<Map<String, String>>() {}); }
    }

    @Converter
    public static class TestCaseList extends Base<List<TestCase>> {
        public TestCaseList() { super(new TypeReference<List<TestCase>>() {}); }
    }
}
