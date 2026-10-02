package com.examdesk.model;

/**
 * One hands-on test. {@code call} is a Java expression (e.g. {@code new Solution().twoSum(new int[]{2,7}, 9)})
 * or a statement block ending with a {@code return}. {@code expected} is a Java expression for the expected value.
 */
public record TestCase(String name, String call, String expected, boolean hidden) {}
