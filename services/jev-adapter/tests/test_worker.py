from __future__ import annotations

import unittest

from jev_adapter.worker import _valid_probability


class ProbabilityValidationTests(unittest.TestCase):
    def test_rejects_boolean_as_probability(self) -> None:
        self.assertIsNone(_valid_probability(True))

    def test_rejects_nan_and_out_of_range_probability(self) -> None:
        self.assertIsNone(_valid_probability(float("nan")))
        self.assertIsNone(_valid_probability(1.1))

    def test_accepts_finite_probability(self) -> None:
        self.assertEqual(_valid_probability(0.72), 0.72)


if __name__ == "__main__":
    unittest.main()
