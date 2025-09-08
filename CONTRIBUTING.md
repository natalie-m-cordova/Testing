<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Contributing to Testing

Thank you for your interest in contributing to the **Testing** project! We welcome contributions from everyone. Please review the following guidelines to help us maintain a healthy and productive community.

## Contributors
<!-- CONTRIBUTORS:START -->
<p align="center">
  <a href="https://github.com/NMRCDova" title="NMRCDova • 130 contributions (12 mo)"><img src="https://avatars.githubusercontent.com/u/165925611?v=4&s=64" width="64px" alt="NMRCDova" /></a>
</p>
<!-- CONTRIBUTORS:END -->


## How to Contribute

1. **Fork the Repository**
   - Click the "Fork" button on GitHub and clone your fork locally.

2. **Create a Branch**
   - Create a new branch for your feature or bugfix:
     ```
     git checkout -b feature/your-feature-name
     ```

3. **Coding Style**
   - Follow consistent naming conventions and indentation.
   - Write clear, descriptive comments.
   - Use Python and HTML best practices.

4. **Testing**
   - Add tests for new features or bug fixes.
   - Ensure all tests pass before submitting a pull request.
   - **Python:**  
     Write your tests using the `unittest` or `pytest` framework.  
     To run tests, use one of the following commands in your terminal:
     ```
     python -m unittest discover
     ```
     or
     ```
     pytest
     ```
   - **HTML:**  
     If your HTML interacts with JavaScript, use a testing framework like [Jest](https://jestjs.io/) or [Selenium](https://www.selenium.dev/).  
     For static HTML, validate your code using the [W3C Markup Validation Service](https://validator.w3.org/).

   - All new code should be covered by tests or validation.

5. **Commit Messages**
   - Write concise, descriptive commit messages.
   - Example: `Fix login bug in authentication module`

6. **Pull Request Process**
   - Push your branch to GitHub.
   - Open a pull request with a clear description of your changes.
   - Reference any related issues in your pull request.

7. **Code Review**
   - Be open to feedback and make requested changes.
   - Review other contributors’ pull requests when possible.

## Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub and provide as much detail as possible.

- **Issue Template:**  
  Please use the provided issue template when submitting your issue. This helps us gather all the necessary information to address your request efficiently.  
  To use the template, click "New Issue" on the GitHub repository and select the appropriate template.

If you have suggestions for improving the template, feel free to open a pull request!

## Community Expectations

- Be respectful and inclusive.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Ask questions if you need help!
- By submitting a contribution, you agree to license your work under the repository’s license (CC BY 4.0).
---

Thank you for helping make **Testing** better!
