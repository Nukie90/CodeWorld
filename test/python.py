# 1. Normal function
def add(a, b):
    return a + b

# 2. Function with default parameter
def greet(name="Guest"):
    return f"Hello, {name}!"

# 3. Function with *args
def sum_all(*numbers):
    return sum(numbers)

# 4. Function with **kwargs
def describe_person(**info):
    return info

# 5. Lambda function
multiply = lambda x, y: x * y

# 6. Nested function
def outer_function(msg):
    def inner_function():
        return f"Inner says: {msg}"
    return inner_function()

# 7. Closure (function returning a function)
def make_multiplier(n):
    def multiplier(x):
        return x * n
    return multiplier

# 8. Recursive function
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n-1)

# 9. Generator function (uses yield)
def countdown(start):
    while start > 0:
        yield start
        start -= 1

# 10. Higher-order function (takes function as argument)
def apply_function(func, value):
    return func(value)

# 11. Anonymous function passed to map/reduce
numbers = [1, 2, 3, 4]
squared = list(map(lambda x: x*x, numbers))

# 12. Async function
import asyncio
async def async_hello():
    return "Hello from async function!"

# 13. Method inside a class
class Example:
    # 14. Instance method
    def instance_method(self):
        return "Instance method called"

    # 15. Class method
    @classmethod
    def class_method(cls):
        return "Class method called"

    # 16. Static method
    @staticmethod
    def static_method():
        return "Static method called"

    # 17. Property (getter)
    @property
    def nice_property(self):
        return "This is a property!"

# 18. Function using type hints
def typed_add(a: int, b: int) -> int:
    return a + b

# Example usage for testing
if __name__ == "__main__":
    print(add(3, 4))
    print(greet())
    print(sum_all(1, 2, 3, 4))
    print(describe_person(name="Alice", age=25))
    print(multiply(3, 5))
    print(outer_function("Hello"))
    
    doubler = make_multiplier(2)
    print(doubler(5))

    print(factorial(5))
    print(list(countdown(5)))
    print(apply_function(lambda x: x + 10, 5))
    print(squared)

    print(asyncio.run(async_hello()))

    obj = Example()
    print(obj.instance_method())
    print(Example.class_method())
    print(Example.static_method())
    print(obj.nice_property)

    print(typed_add(10, 20))
