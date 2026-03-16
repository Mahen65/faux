"""Mapping from classified field types to Faker providers."""

from typing import Callable
from faker import Faker

# field_type -> Faker generator function
FAKER_MAP: dict[str, Callable[[Faker], str]] = {
    "first_name": lambda f: f.first_name(),
    "last_name": lambda f: f.last_name(),
    "full_name": lambda f: f.name(),
    "email": lambda f: f.email(),
    "phone": lambda f: f.phone_number(),
    "password": lambda f: f.password(length=16, special_chars=True),
    "username": lambda f: f.user_name(),
    "street_address": lambda f: f.street_address(),
    "city": lambda f: f.city(),
    "state": lambda f: f.state(),
    "zip_code": lambda f: f.zipcode(),
    "country": lambda f: f.country(),
    "date_of_birth": lambda f: f.date_of_birth(minimum_age=18, maximum_age=80).isoformat(),
    "date": lambda f: f.date_this_decade().isoformat(),
    "company": lambda f: f.company(),
    "job_title": lambda f: f.job(),
    "url": lambda f: f.url(),
    "number": lambda f: str(f.random_int(min=1, max=9999)),
    "credit_card": lambda f: f.credit_card_number(),
    "cvv": lambda f: f.credit_card_security_code(),
    "expiry": lambda f: f"{f.random_int(1, 12):02d}/{f.random_int(25, 30)}",
    "message": lambda f: f.paragraph(nb_sentences=3),
    "comment": lambda f: f.sentence(nb_words=10),
    "textarea": lambda f: f.paragraph(nb_sentences=2),
    "search": lambda f: f.word(),
    "checkbox": lambda _f: "true",
    "radio": lambda _f: "true",
    "select": lambda _f: "",  # Select handled by extension (picks from options)
    "identifier": lambda f: f"ID-{f.random_int(10000, 99999)}",
    "measurement": lambda f: str(f.random_int(min=-10, max=120)),
    "unknown": lambda f: f.word(),
}
