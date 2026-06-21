fn main(secret: Field, expected_square: pub Field) {
    assert(secret * secret == expected_square);
}

#[test]
fn accepts_valid_witness() {
    main(7, 49);
}

#[test(should_fail)]
fn rejects_invalid_witness() {
    main(7, 48);
}
